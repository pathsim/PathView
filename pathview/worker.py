"""
REPL Worker Subprocess for PathView Flask Backend.

Direct port of worker.ts to Python. Reads JSON messages from stdin,
executes Python code, and writes JSON responses to stdout.

Same message protocol (REPLRequest/REPLResponse as JSON lines over stdin/stdout).

Threading model:
- Main thread: reads stdin, processes init/exec/eval synchronously
- During streaming: a reader thread handles stream-stop and stream-exec,
  puts non-streaming messages into a leftover queue
- After streaming: main thread drains leftovers before resuming stdin reads
- Stdout lock: thread-safe writing to stdout (protocol messages only)
"""

import sys
import os
import json
import subprocess
import threading
import traceback
import queue
import ctypes

from pathview.config import EXEC_TIMEOUT

# Lock for thread-safe stdout writing (protocol messages only)
_stdout_lock = threading.Lock()

# Keep a reference to the real stdout pipe — protocol messages go here.
# We dup() fd 1 so that _real_stdout survives the fd-level redirect below.
_real_stdout_fd = os.dup(1)
_real_stdout = os.fdopen(_real_stdout_fd, "w")

# Redirect OS-level fd 1 to devnull so that C/C++ libraries (e.g. jsbsim)
# writing directly to stdout via printf/cout cannot corrupt the JSON protocol.
_devnull_fd = os.open(os.devnull, os.O_WRONLY)
os.dup2(_devnull_fd, 1)
os.close(_devnull_fd)

# Worker state
_namespace = {}
_initialized = False

# Streaming state
_streaming_active = False
_streaming_code_queue = queue.Queue()
_leftover_queue: queue.Queue[dict | None] = queue.Queue()


def send(response: dict) -> None:
    """Send a JSON response to the parent process via stdout."""
    with _stdout_lock:
        _real_stdout.write(json.dumps(response) + "\n")
        _real_stdout.flush()


class _ProtocolWriter:
    """File-like object that routes writes through the worker protocol.

    Installed as sys.stdout/sys.stderr permanently so that ALL output
    (print, logging handlers, third-party libraries) is captured and
    forwarded to the frontend console. This avoids the stale-reference
    bug where StreamHandler(sys.stdout) captures a temporary StringIO.
    """

    def __init__(self, msg_type: str):
        self.msg_type = msg_type
        self._in_write = False

    def write(self, text: str) -> int:
        if text and not self._in_write:
            self._in_write = True
            try:
                send({"type": self.msg_type, "value": text})
            except Exception:
                pass
            finally:
                self._in_write = False
        return len(text) if text else 0

    def flush(self) -> None:
        pass

    def isatty(self) -> bool:
        return False


def read_message():
    """Read one JSON message from stdin. Returns None on EOF."""
    while True:
        line = sys.stdin.readline()
        if not line:
            return None
        line = line.strip()
        if line:
            return json.loads(line)


def _install_package(pip_spec: str, pre: bool = False) -> None:
    """Install a package via pip if not already available."""
    cmd = [sys.executable, "-m", "pip", "install", pip_spec, "--quiet"]
    if pre:
        cmd.append("--pre")
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"pip install failed for {pip_spec}: {result.stderr.strip()}")


def _ensure_package(pkg: dict) -> None:
    """Ensure a package is installed and importable. Mirrors the Pyodide worker loop."""
    import_name = pkg.get("import", "")
    pip_spec = pkg.get("pip", import_name)
    required = pkg.get("required", False)
    pre = pkg.get("pre", False)

    send({"type": "progress", "value": f"Installing {import_name}..."})

    try:
        # Try importing first — skip pip if already installed
        exec(f"import {import_name}", _namespace)
    except ImportError:
        # Not installed — pip install then import
        _install_package(pip_spec, pre)
        exec(f"import {import_name}", _namespace)

    # Log version if available
    try:
        version = eval(f"{import_name}.__version__", _namespace)
        send({"type": "stdout", "value": f"{import_name} {version} loaded successfully\n"})
    except Exception:
        send({"type": "stdout", "value": f"{import_name} loaded successfully\n"})


def initialize(packages: list[dict] | None = None) -> None:
    """Initialize the worker: install packages, import standard libs, capture clean globals."""
    global _initialized, _namespace

    if _initialized:
        send({"type": "ready"})
        return

    send({"type": "progress", "value": "Initializing Python worker..."})

    # Replace sys.stdout/stderr with protocol writers BEFORE importing packages.
    # Any StreamHandler created later (e.g. by pathsim's LoggerManager singleton)
    # will capture these persistent objects, so logging always routes through send().
    sys.stdout = _ProtocolWriter("stdout")
    sys.stderr = _ProtocolWriter("stderr")

    # Set up the namespace with common imports
    _namespace = {"__builtins__": __builtins__}
    exec("import gc", _namespace)
    exec("import json", _namespace)

    # Install packages FIRST (pathsim brings numpy as a dependency)
    if packages:
        send({"type": "progress", "value": "Installing dependencies..."})
        for pkg in packages:
            try:
                _ensure_package(pkg)
            except Exception as e:
                if pkg.get("required", False):
                    raise RuntimeError(
                        f"Failed to install required package {pkg.get('pip', pkg.get('import', '?'))}: {e}"
                    )
                send({"type": "stderr", "value": f"Optional package {pkg.get('import', '?')} failed: {e}\n"})

    # Import numpy AFTER packages are installed (numpy comes with pathsim).
    try:
        exec("import numpy as np", _namespace)
    except Exception:
        pass

    _initialized = True
    send({"type": "ready"})


def _raise_in_thread(thread_id: int, exc_type: type) -> None:
    """Raise an exception in the given thread (best-effort interrupt)."""
    ctypes.pythonapi.PyThreadState_SetAsyncExc(
        ctypes.c_ulong(thread_id), ctypes.py_object(exc_type)
    )


def _run_with_timeout(func, timeout: float = EXEC_TIMEOUT):
    """Run func() in a daemon thread with a timeout.

    Returns (result, error_string, traceback_string).
    If timeout fires, raises TimeoutError.
    """
    result_holder = [None, None, None]  # result, error, traceback

    def target():
        try:
            result_holder[0] = func()
        except Exception as e:
            result_holder[1] = str(e)
            result_holder[2] = traceback.format_exc()

    t = threading.Thread(target=target, daemon=True)
    t.start()
    t.join(timeout)

    if t.is_alive():
        # Try to interrupt the stuck thread
        _raise_in_thread(t.ident, KeyboardInterrupt)
        t.join(2)  # Give it 2s to handle the interrupt
        raise TimeoutError(f"Execution timed out after {timeout}s")

    if result_holder[1] is not None:
        raise _ExecError(result_holder[1], result_holder[2])

    return result_holder[0]


class _ExecError(Exception):
    """Wraps an error from user code execution with its traceback."""
    def __init__(self, message: str, tb: str | None = None):
        super().__init__(message)
        self.tb = tb


def exec_code(msg_id: str, code: str) -> None:
    """Execute Python code (no return value)."""
    if not _initialized:
        send({"type": "error", "id": msg_id, "error": "Worker not initialized"})
        return

    try:
        _run_with_timeout(lambda: exec(code, _namespace))
        send({"type": "ok", "id": msg_id})
    except TimeoutError as e:
        send({"type": "error", "id": msg_id, "error": str(e)})
    except _ExecError as e:
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": e.tb})


def eval_expr(msg_id: str, expr: str) -> None:
    """Evaluate Python expression and return JSON result."""
    if not _initialized:
        send({"type": "error", "id": msg_id, "error": "Worker not initialized"})
        return

    try:
        def do_eval():
            exec_code_str = f"_eval_result = {expr}"
            exec(exec_code_str, _namespace)

        _run_with_timeout(do_eval)
        to_json = _namespace.get("_to_json", str)
        result = json.dumps(_namespace["_eval_result"], default=to_json)
        send({"type": "value", "id": msg_id, "value": result})
    except TimeoutError as e:
        send({"type": "error", "id": msg_id, "error": str(e)})
    except _ExecError as e:
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": e.tb})


def _streaming_reader_thread(stop_event: threading.Event) -> None:
    """Read stdin during streaming, handling stream-stop and stream-exec.

    Non-streaming messages are saved to _leftover_queue for the main loop.
    After stop_event is set, the thread will exit once it reads one more line
    (the flush message sent by the server).
    """
    global _streaming_active
    while True:
        line = sys.stdin.readline()
        if not line:
            # EOF — stop streaming
            _streaming_active = False
            _leftover_queue.put(None)
            break
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            send({"type": "error", "error": f"Invalid JSON: {line}"})
            continue

        # If stop_event is set, we're just flushing — put message in leftovers
        if stop_event.is_set():
            _leftover_queue.put(msg)
            break

        msg_type = msg.get("type")
        if msg_type == "stream-stop":
            _streaming_active = False
        elif msg_type == "stream-exec":
            code = msg.get("code")
            if code and _streaming_active:
                _streaming_code_queue.put(code)
        else:
            # Non-streaming message arrived — save for main loop
            _leftover_queue.put(msg)


def run_streaming_loop(msg_id: str, expr: str) -> None:
    """Run streaming loop - steps generator continuously and posts results."""
    global _streaming_active

    if not _initialized:
        send({"type": "error", "id": msg_id, "error": "Worker not initialized"})
        return

    _streaming_active = True
    # Clear any stale code from previous runs
    while not _streaming_code_queue.empty():
        try:
            _streaming_code_queue.get_nowait()
        except queue.Empty:
            break

    # Start reader thread to handle stream-stop and stream-exec
    stop_event = threading.Event()
    reader = threading.Thread(target=_streaming_reader_thread, args=(stop_event,), daemon=True)
    reader.start()

    try:
        while _streaming_active:
            # Execute any queued code first (for runtime parameter changes)
            # Errors in queued code are reported but don't stop the simulation
            while True:
                try:
                    code = _streaming_code_queue.get_nowait()
                except queue.Empty:
                    break
                try:
                    exec(code, _namespace)
                except Exception as e:
                    send({"type": "stderr", "value": f"Stream exec error: {e}"})

            # Step the generator (with timeout so a stuck C extension
            # doesn't hang the worker forever)
            try:
                _run_with_timeout(
                    lambda: exec(f"_eval_result = {expr}", _namespace),
                    timeout=EXEC_TIMEOUT,
                )
            except TimeoutError:
                send({"type": "error", "id": msg_id,
                      "error": f"Simulation step timed out after {EXEC_TIMEOUT}s"})
                break
            raw_result = _namespace["_eval_result"]
            done = raw_result.get("done", False) if isinstance(raw_result, dict) else False

            # Check if stopped during Python execution - still send final data
            if not _streaming_active:
                if not done and (isinstance(raw_result, dict) and raw_result.get("result")):
                    to_json = _namespace.get("_to_json", str)
                    send({"type": "stream-data", "id": msg_id, "value": json.dumps(raw_result, default=to_json)})
                break

            # Check if simulation completed
            if done:
                break

            # Send result and continue
            to_json = _namespace.get("_to_json", str)
            send({"type": "stream-data", "id": msg_id, "value": json.dumps(raw_result, default=to_json)})

    except Exception as e:
        tb = traceback.format_exc()
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": tb})
    finally:
        _streaming_active = False
        stop_event.set()
        # Always send done when loop ends
        send({"type": "stream-done", "id": msg_id})
        # Reader thread will exit on the next stdin read (flush message from server)


def main() -> None:
    """Main loop: read messages from stdin and process them."""
    while True:
        # First drain any leftover messages from the streaming reader thread
        msg = None
        while not _leftover_queue.empty():
            try:
                msg = _leftover_queue.get_nowait()
                if msg is not None:
                    break
            except queue.Empty:
                break

        # If no leftover, read from stdin directly
        if msg is None:
            msg = read_message()
        if msg is None:
            # stdin closed, exit
            break

        msg_type = msg.get("type")
        msg_id = msg.get("id")
        code = msg.get("code")
        expr = msg.get("expr")

        try:
            if msg_type == "init":
                initialize(packages=msg.get("packages"))

            elif msg_type == "exec":
                if not msg_id or not isinstance(code, str):
                    raise ValueError("Invalid exec request: missing id or code")
                exec_code(msg_id, code)

            elif msg_type == "eval":
                if not msg_id or not isinstance(expr, str):
                    raise ValueError("Invalid eval request: missing id or expr")
                eval_expr(msg_id, expr)

            elif msg_type == "stream-start":
                if not msg_id or not isinstance(expr, str):
                    raise ValueError("Invalid stream-start request: missing id or expr")
                # Blocking: runs streaming loop, reader thread handles
                # stream-stop and stream-exec during this time
                run_streaming_loop(msg_id, expr)

            elif msg_type == "stream-stop":
                # Only during streaming (handled by reader thread)
                pass

            elif msg_type == "stream-exec":
                # Only during streaming (handled by reader thread)
                pass

            elif msg_type == "noop":
                # Flush message from server — ignore
                pass

            else:
                raise ValueError(f"Unknown message type: {msg_type}")

        except Exception as e:
            send({
                "type": "error",
                "id": msg_id,
                "error": str(e),
            })


if __name__ == "__main__":
    main()
