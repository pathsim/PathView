"""
REPL Worker Subprocess for PathView Flask Backend.

Direct port of worker.ts to Python. Reads JSON messages from stdin,
executes Python code, and writes JSON responses to stdout.

Same message protocol (REPLRequest/REPLResponse as JSON lines over stdin/stdout).

Threading model:
- Main thread: reads stdin, processes init/exec/eval synchronously
- During streaming: a reader thread handles stream-stop and stream-exec
  while the main thread runs the streaming loop
- Stdout lock: thread-safe writing to stdout (protocol messages only)
"""

import sys
import io
import json
import subprocess
import threading
import traceback
import queue

# Lock for thread-safe stdout writing (protocol messages only)
_stdout_lock = threading.Lock()

# Worker state
_namespace = {}
_initialized = False

# Streaming state
_streaming_active = False
_streaming_code_queue = queue.Queue()


def send(response: dict) -> None:
    """Send a JSON response to the parent process via stdout."""
    with _stdout_lock:
        sys.stdout.write(json.dumps(response) + "\n")
        sys.stdout.flush()


def _capture_output(func):
    """Run func with stdout/stderr captured, sending output as messages."""
    old_stdout = sys.stdout
    old_stderr = sys.stderr
    captured_out = io.StringIO()
    captured_err = io.StringIO()
    sys.stdout = captured_out
    sys.stderr = captured_err
    try:
        result = func()
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr
        out = captured_out.getvalue()
        err = captured_err.getvalue()
        if out:
            send({"type": "stdout", "value": out})
        if err:
            send({"type": "stderr", "value": err})
    return result


def read_message():
    """Read one JSON message from stdin. Returns None on EOF."""
    line = sys.stdin.readline()
    if not line:
        return None
    line = line.strip()
    if not line:
        return read_message()  # skip blank lines
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

    # Set up the namespace with common imports
    _namespace = {"__builtins__": __builtins__}
    exec("import numpy as np", _namespace)
    exec("import gc", _namespace)
    exec("import json", _namespace)

    # Install and import packages from the frontend config (single source of truth)
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

    _initialized = True
    send({"type": "ready"})


def exec_code(msg_id: str, code: str) -> None:
    """Execute Python code (no return value)."""
    if not _initialized:
        send({"type": "error", "id": msg_id, "error": "Worker not initialized"})
        return

    try:
        def run():
            exec(code, _namespace)
        _capture_output(run)
        send({"type": "ok", "id": msg_id})
    except Exception as e:
        tb = traceback.format_exc()
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": tb})


def eval_expr(msg_id: str, expr: str) -> None:
    """Evaluate Python expression and return JSON result."""
    if not _initialized:
        send({"type": "error", "id": msg_id, "error": "Worker not initialized"})
        return

    try:
        def run():
            # Mirror worker.ts: store result, then JSON-serialize
            exec_code_str = f"_eval_result = {expr}"
            exec(exec_code_str, _namespace)
            to_json = _namespace.get("_to_json", str)
            return json.dumps(_namespace["_eval_result"], default=to_json)
        result = _capture_output(run)
        send({"type": "value", "id": msg_id, "value": result})
    except Exception as e:
        tb = traceback.format_exc()
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": tb})


def _streaming_reader_thread(stop_event: threading.Event) -> None:
    """Read stdin during streaming, handling stream-stop and stream-exec."""
    global _streaming_active
    while not stop_event.is_set():
        line = sys.stdin.readline()
        if not line:
            # EOF — stop streaming and signal main loop to exit
            _streaming_active = False
            break
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            send({"type": "error", "error": f"Invalid JSON: {line}"})
            continue

        msg_type = msg.get("type")
        if msg_type == "stream-stop":
            _streaming_active = False
        elif msg_type == "stream-exec":
            code = msg.get("code")
            if code and _streaming_active:
                _streaming_code_queue.put(code)
        # Other messages during streaming are ignored (shouldn't happen)


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
                    def run_queued(c=code):
                        exec(c, _namespace)
                    _capture_output(run_queued)
                except Exception as e:
                    send({"type": "stderr", "value": f"Stream exec error: {e}"})

            # Step the generator
            def run_step():
                exec_code_str = f"_eval_result = {expr}"
                exec(exec_code_str, _namespace)
                to_json = _namespace.get("_to_json", str)
                return json.dumps(_namespace["_eval_result"], default=to_json)
            result = _capture_output(run_step)

            # Parse result
            parsed = json.loads(result)

            # Check if stopped during Python execution - still send final data
            if not _streaming_active:
                if not parsed.get("done") and parsed.get("result"):
                    send({"type": "stream-data", "id": msg_id, "value": result})
                break

            # Check if simulation completed
            if parsed.get("done"):
                break

            # Send result and continue
            send({"type": "stream-data", "id": msg_id, "value": result})

    except Exception as e:
        tb = traceback.format_exc()
        send({"type": "error", "id": msg_id, "error": str(e), "traceback": tb})
    finally:
        _streaming_active = False
        stop_event.set()
        # Always send done when loop ends
        send({"type": "stream-done", "id": msg_id})


def stop_streaming() -> None:
    """Stop the streaming loop."""
    global _streaming_active
    _streaming_active = False


def main() -> None:
    """Main loop: read messages from stdin and process them."""
    while True:
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
                stop_streaming()

            elif msg_type == "stream-exec":
                if isinstance(code, str) and _streaming_active:
                    _streaming_code_queue.put(code)

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
