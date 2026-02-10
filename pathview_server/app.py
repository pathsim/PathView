"""
Flask server for PathView backend.

Manages worker subprocesses per session. Routes translate HTTP requests
into subprocess messages and relay responses back.

Each session gets its own worker subprocess with an isolated Python namespace.
"""

import os
import sys
import json
import queue
import subprocess
import threading
import time
import uuid
import atexit
from pathlib import Path

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SESSION_TTL = 3600  # 1 hour of inactivity before cleanup
CLEANUP_INTERVAL = 60  # Check for stale sessions every 60 seconds
EXEC_TIMEOUT = 35  # Server-side timeout for exec/eval (slightly > worker's 30s)
WORKER_SCRIPT = str(Path(__file__).parent / "worker.py")

# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

class Session:
    """A worker subprocess bound to a session."""

    def __init__(self, session_id: str):
        self.session_id = session_id
        self.last_active = time.time()
        self.lock = threading.Lock()
        self.process = subprocess.Popen(
            [sys.executable, "-u", WORKER_SCRIPT],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            bufsize=1,  # line buffered
        )
        self._initialized = False
        # Streaming state: background thread reads worker stdout into a queue
        self._stream_queue: queue.Queue[dict] = queue.Queue()
        self._stream_reader: threading.Thread | None = None
        self._streaming = False

    def send_message(self, msg: dict) -> None:
        """Write a JSON message to the subprocess stdin."""
        self.last_active = time.time()
        line = json.dumps(msg) + "\n"
        self.process.stdin.write(line)
        self.process.stdin.flush()

    def read_line(self) -> dict | None:
        """Read one JSON line from the subprocess stdout."""
        line = self.process.stdout.readline()
        if not line:
            return None
        return json.loads(line.strip())

    def read_line_timeout(self, timeout: float = EXEC_TIMEOUT) -> dict | None:
        """Read one JSON line with a timeout. Returns None on EOF or timeout.

        Raises TimeoutError if no response within the timeout period.
        """
        result = [None]
        error = [None]

        def reader():
            try:
                result[0] = self.read_line()
            except Exception as e:
                error[0] = e

        t = threading.Thread(target=reader, daemon=True)
        t.start()
        t.join(timeout)

        if t.is_alive():
            raise TimeoutError(f"Worker unresponsive after {timeout}s")

        if error[0]:
            raise error[0]

        return result[0]

    def ensure_initialized(self, packages: list[dict] | None = None) -> list[dict]:
        """Initialize the worker if not already done. Returns any messages received."""
        if self._initialized:
            return []
        messages = []
        init_msg = {"type": "init"}
        if packages:
            init_msg["packages"] = packages
        self.send_message(init_msg)
        while True:
            resp = self.read_line()
            if resp is None:
                raise RuntimeError("Worker process died during initialization")
            messages.append(resp)
            if resp.get("type") == "ready":
                self._initialized = True
                break
            if resp.get("type") == "error":
                raise RuntimeError(resp.get("error", "Unknown init error"))
        return messages

    def start_stream_reader(self) -> None:
        """Start a background thread that reads worker stdout into the stream queue."""
        self._streaming = True
        # Clear any stale messages
        while not self._stream_queue.empty():
            try:
                self._stream_queue.get_nowait()
            except queue.Empty:
                break

        def reader():
            while self._streaming:
                resp = self.read_line()
                if resp is None:
                    self._stream_queue.put({"type": "error", "error": "Worker process died"})
                    self._streaming = False
                    break
                self._stream_queue.put(resp)
                if resp.get("type") in ("stream-done", "error"):
                    self._streaming = False
                    break

        self._stream_reader = threading.Thread(target=reader, daemon=True)
        self._stream_reader.start()

    def stop_stream_reader(self) -> None:
        """Signal the stream reader to stop."""
        self._streaming = False

    def wait_for_stream_reader(self, timeout: float = 5) -> None:
        """Wait for the stream reader thread to fully exit.

        Must be called before any direct stdout reads (exec/eval) to prevent
        concurrent reads on the same pipe which cause JSONDecodeError.

        Actively stops streaming if needed: sends stream-stop to the worker
        so it sends stream-done, which unblocks the reader thread.
        """
        reader = self._stream_reader
        if reader is None:
            return

        if reader.is_alive():
            self._streaming = False
            # Ensure the worker stops streaming — stream-stop might not have
            # been sent yet if api_stream_stop races with api_exec.
            try:
                self.send_message({"type": "stream-stop"})
            except Exception:
                pass
            reader.join(timeout)

        # Send noop to unblock the worker's stdin reader thread so the
        # worker main loop can resume processing exec/eval messages.
        self.flush_worker_reader()

        self._stream_reader = None

        # Drain stale stream messages (stream-data, stream-done) from the
        # queue so they don't leak into subsequent poll responses.
        while not self._stream_queue.empty():
            try:
                self._stream_queue.get_nowait()
            except queue.Empty:
                break

    def flush_worker_reader(self) -> None:
        """Send a noop message to unblock the worker's stdin reader thread.

        After streaming ends, the worker's reader thread is blocked on stdin.readline().
        This sends a harmless message so the reader thread wakes up, checks stop_event,
        and exits — allowing the main thread to resume reading stdin safely.
        """
        try:
            self.send_message({"type": "noop"})
        except Exception:
            pass

    def drain_stream_queue(self) -> list[dict]:
        """Drain all messages currently in the stream queue."""
        messages = []
        while True:
            try:
                messages.append(self._stream_queue.get_nowait())
            except queue.Empty:
                break
        return messages

    def is_alive(self) -> bool:
        return self.process.poll() is None

    def kill(self) -> None:
        """Kill the subprocess."""
        self._streaming = False
        try:
            self.process.stdin.close()
        except Exception:
            pass
        try:
            self.process.kill()
            self.process.wait(timeout=5)
        except Exception:
            pass


# Global session store
_sessions: dict[str, Session] = {}
_sessions_lock = threading.Lock()


def get_or_create_session(session_id: str) -> Session:
    """Get an existing session or create a new one."""
    with _sessions_lock:
        session = _sessions.get(session_id)
        if session and not session.is_alive():
            # Dead process, remove stale entry
            _sessions.pop(session_id, None)
            session = None
        if session is None:
            session = Session(session_id)
            _sessions[session_id] = session
        return session


def remove_session(session_id: str) -> None:
    """Kill and remove a session."""
    with _sessions_lock:
        session = _sessions.pop(session_id, None)
    if session:
        session.kill()


def cleanup_stale_sessions() -> None:
    """Remove sessions that have been inactive beyond TTL."""
    while True:
        time.sleep(CLEANUP_INTERVAL)
        now = time.time()
        stale = []
        with _sessions_lock:
            for sid, session in _sessions.items():
                if now - session.last_active > SESSION_TTL:
                    stale.append(sid)
        for sid in stale:
            remove_session(sid)


_cleanup_started = False


def _start_cleanup_thread() -> None:
    """Start the cleanup thread once (idempotent)."""
    global _cleanup_started
    if _cleanup_started:
        return
    _cleanup_started = True
    t = threading.Thread(target=cleanup_stale_sessions, daemon=True)
    t.start()


def _get_session_id() -> str | None:
    """Extract session ID from request headers. Returns None if missing."""
    return request.headers.get("X-Session-ID")


# ---------------------------------------------------------------------------
# App factory
# ---------------------------------------------------------------------------

def create_app(serve_static: bool = False) -> Flask:
    """Create the Flask application.

    Args:
        serve_static: If True, serve the bundled frontend and skip CORS.
                      If False, API-only mode with CORS (for dev with Vite).
    """
    app = Flask(__name__)
    _start_cleanup_thread()

    if not serve_static:
        CORS(app)

    # -----------------------------------------------------------------------
    # API routes
    # -----------------------------------------------------------------------

    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok"})

    @app.route("/api/init", methods=["POST"])
    def api_init():
        """Initialize a session's worker with packages from the frontend config."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"type": "error", "error": "Missing X-Session-ID header"}), 400
        data = request.get_json(force=True)
        packages = data.get("packages", [])

        session = get_or_create_session(session_id)
        with session.lock:
            try:
                messages = session.ensure_initialized(packages=packages)
                return jsonify({"type": "ready", "messages": messages})
            except Exception as e:
                return jsonify({"type": "error", "error": str(e)}), 500

    @app.route("/api/exec", methods=["POST"])
    def api_exec():
        """Execute Python code in the session's worker."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"type": "error", "error": "Missing X-Session-ID header"}), 400
        data = request.get_json(force=True)
        code = data.get("code", "")
        msg_id = data.get("id", str(uuid.uuid4()))

        session = get_or_create_session(session_id)
        with session.lock:
            try:
                # Wait for any lingering stream reader thread to exit before
                # reading stdout — prevents concurrent pipe reads / JSONDecodeError
                session.wait_for_stream_reader()
                session.ensure_initialized()
                session.send_message({"type": "exec", "id": msg_id, "code": code})

                stdout_lines = []
                stderr_lines = []
                while True:
                    resp = session.read_line_timeout()
                    if resp is None:
                        remove_session(session_id)
                        return jsonify({"type": "error", "errorType": "worker-crashed", "id": msg_id, "error": "Worker process died"}), 500
                    resp_type = resp.get("type")
                    if resp_type == "stdout":
                        stdout_lines.append(resp.get("value", ""))
                    elif resp_type == "stderr":
                        stderr_lines.append(resp.get("value", ""))
                    elif resp_type == "ok" and resp.get("id") == msg_id:
                        result = {"type": "ok", "id": msg_id}
                        if stdout_lines:
                            result["stdout"] = "".join(stdout_lines)
                        if stderr_lines:
                            result["stderr"] = "".join(stderr_lines)
                        return jsonify(result)
                    elif resp_type == "error" and resp.get("id") == msg_id:
                        result = resp
                        if stdout_lines:
                            result["stdout"] = "".join(stdout_lines)
                        if stderr_lines:
                            result["stderr"] = "".join(stderr_lines)
                        return jsonify(result), 400

            except TimeoutError:
                remove_session(session_id)
                return jsonify({"type": "error", "errorType": "timeout", "id": msg_id, "error": "Execution timed out"}), 504
            except Exception as e:
                return jsonify({"type": "error", "id": msg_id, "error": str(e)}), 500

    @app.route("/api/eval", methods=["POST"])
    def api_eval():
        """Evaluate a Python expression in the session's worker."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"type": "error", "error": "Missing X-Session-ID header"}), 400
        data = request.get_json(force=True)
        expr = data.get("expr", "")
        msg_id = data.get("id", str(uuid.uuid4()))

        session = get_or_create_session(session_id)
        with session.lock:
            try:
                # Wait for any lingering stream reader thread to exit before
                # reading stdout — prevents concurrent pipe reads / JSONDecodeError
                session.wait_for_stream_reader()
                session.ensure_initialized()
                session.send_message({"type": "eval", "id": msg_id, "expr": expr})

                stdout_lines = []
                stderr_lines = []
                while True:
                    resp = session.read_line_timeout()
                    if resp is None:
                        remove_session(session_id)
                        return jsonify({"type": "error", "errorType": "worker-crashed", "id": msg_id, "error": "Worker process died"}), 500
                    resp_type = resp.get("type")
                    if resp_type == "stdout":
                        stdout_lines.append(resp.get("value", ""))
                    elif resp_type == "stderr":
                        stderr_lines.append(resp.get("value", ""))
                    elif resp_type == "value" and resp.get("id") == msg_id:
                        result = resp
                        if stdout_lines:
                            result["stdout"] = "".join(stdout_lines)
                        if stderr_lines:
                            result["stderr"] = "".join(stderr_lines)
                        return jsonify(result)
                    elif resp_type == "error" and resp.get("id") == msg_id:
                        result = resp
                        if stdout_lines:
                            result["stdout"] = "".join(stdout_lines)
                        if stderr_lines:
                            result["stderr"] = "".join(stderr_lines)
                        return jsonify(result), 400

            except TimeoutError:
                remove_session(session_id)
                return jsonify({"type": "error", "errorType": "timeout", "id": msg_id, "error": "Execution timed out"}), 504
            except Exception as e:
                return jsonify({"type": "error", "id": msg_id, "error": str(e)}), 500

    @app.route("/api/stream/start", methods=["POST"])
    def api_stream_start():
        """Start streaming — sends stream-start to worker and returns immediately.

        A background thread reads worker stdout into a queue.  The frontend
        polls /api/stream/poll to drain that queue, mirroring how the Pyodide
        worker sends stream-data / stream-done messages via postMessage.
        """
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"type": "error", "error": "Missing X-Session-ID header"}), 400
        data = request.get_json(force=True)
        expr = data.get("expr", "")
        msg_id = data.get("id", str(uuid.uuid4()))

        session = get_or_create_session(session_id)
        with session.lock:
            try:
                session.ensure_initialized()
                session.send_message({"type": "stream-start", "id": msg_id, "expr": expr})
                session.start_stream_reader()
                return jsonify({"status": "started", "id": msg_id})
            except Exception as e:
                return jsonify({"type": "error", "error": str(e)}), 500

    @app.route("/api/stream/poll", methods=["POST"])
    def api_stream_poll():
        """Poll for stream messages — returns all queued messages since last poll."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"type": "error", "error": "Missing X-Session-ID header"}), 400
        with _sessions_lock:
            session = _sessions.get(session_id)
        if not session:
            return jsonify({"messages": [], "done": True})
        messages = session.drain_stream_queue()
        done = any(m.get("type") in ("stream-done", "error") for m in messages)
        if done:
            # Send noop to unblock the worker's stdin reader thread
            # so the main thread can resume processing exec/eval
            session.flush_worker_reader()
        return jsonify({"messages": messages, "done": done})

    @app.route("/api/stream/exec", methods=["POST"])
    def api_stream_exec():
        """Queue code to execute during an active stream."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"error": "Missing X-Session-ID header"}), 400
        data = request.get_json(force=True)
        code = data.get("code", "")

        with _sessions_lock:
            session = _sessions.get(session_id)
        if not session:
            return jsonify({"error": "No active session"}), 404
        try:
            session.send_message({"type": "stream-exec", "code": code})
            return jsonify({"status": "queued"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/stream/stop", methods=["POST"])
    def api_stream_stop():
        """Stop an active streaming session."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"error": "Missing X-Session-ID header"}), 400

        with _sessions_lock:
            session = _sessions.get(session_id)
        if not session:
            return jsonify({"status": "stopped"})
        try:
            session.send_message({"type": "stream-stop"})
            return jsonify({"status": "stopped"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/session", methods=["DELETE"])
    def api_session_delete():
        """Kill a session's worker subprocess."""
        session_id = _get_session_id()
        if not session_id:
            return jsonify({"error": "Missing X-Session-ID header"}), 400
        remove_session(session_id)
        return jsonify({"status": "terminated"})

    # -----------------------------------------------------------------------
    # Static file serving (pip package mode)
    # -----------------------------------------------------------------------

    if serve_static:
        static_dir = Path(__file__).parent / "static"

        @app.route("/", defaults={"path": ""})
        @app.route("/<path:path>")
        def serve_frontend(path):
            """Serve the bundled SvelteKit frontend with SPA fallback."""
            if path.startswith("api/"):
                return jsonify({"error": "Not found"}), 404

            file_path = static_dir / path
            if path and file_path.is_file():
                return send_from_directory(static_dir, path)

            # SPA fallback
            return send_from_directory(static_dir, "index.html")

    return app


# ---------------------------------------------------------------------------
# Cleanup on exit
# ---------------------------------------------------------------------------

@atexit.register
def _cleanup_all_sessions():
    with _sessions_lock:
        for session in _sessions.values():
            session.kill()
        _sessions.clear()


# ---------------------------------------------------------------------------
# Entry point (dev mode: API-only with CORS)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"PathView Flask backend (API-only) starting on port {port}")
    app = create_app(serve_static=False)
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
