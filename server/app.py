"""
Flask server for PathView backend.

Manages worker subprocesses per session. Routes translate HTTP requests
into subprocess messages and relay responses back.

Each session gets its own worker subprocess with an isolated Python namespace.
"""

import os
import sys
import json
import subprocess
import threading
import time
import uuid
import atexit
from pathlib import Path

from flask import Flask, Response, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SESSION_TTL = 3600  # 1 hour of inactivity before cleanup
CLEANUP_INTERVAL = 60  # Check for stale sessions every 60 seconds
REQUEST_TIMEOUT = 300  # 5 minutes default timeout for exec/eval
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

    def is_alive(self) -> bool:
        return self.process.poll() is None

    def kill(self) -> None:
        """Kill the subprocess."""
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


# Start cleanup thread
_cleanup_thread = threading.Thread(target=cleanup_stale_sessions, daemon=True)
_cleanup_thread.start()


def _get_session_id() -> str:
    """Extract session ID from request headers or generate one."""
    return request.headers.get("X-Session-ID") or str(uuid.uuid4())


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"})


@app.route("/api/init", methods=["POST"])
def api_init():
    """Initialize a session's worker with packages from the frontend config."""
    session_id = _get_session_id()
    data = request.get_json(force=True)
    packages = data.get("packages", [])

    session = get_or_create_session(session_id)
    with session.lock:
        try:
            messages = session.ensure_initialized(packages=packages)
            # Return all progress/stdout/stderr messages collected during init
            return jsonify({"type": "ready", "messages": messages})
        except Exception as e:
            return jsonify({"type": "error", "error": str(e)}), 500


@app.route("/api/exec", methods=["POST"])
def api_exec():
    """Execute Python code in the session's worker."""
    session_id = _get_session_id()
    data = request.get_json(force=True)
    code = data.get("code", "")
    msg_id = data.get("id", str(uuid.uuid4()))

    session = get_or_create_session(session_id)
    with session.lock:
        try:
            session.ensure_initialized()
            session.send_message({"type": "exec", "id": msg_id, "code": code})

            # Collect responses until we get ok/error for this id
            stdout_lines = []
            stderr_lines = []
            while True:
                resp = session.read_line()
                if resp is None:
                    return jsonify({"type": "error", "id": msg_id, "error": "Worker process died"}), 500
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

        except Exception as e:
            return jsonify({"type": "error", "id": msg_id, "error": str(e)}), 500


@app.route("/api/eval", methods=["POST"])
def api_eval():
    """Evaluate a Python expression in the session's worker."""
    session_id = _get_session_id()
    data = request.get_json(force=True)
    expr = data.get("expr", "")
    msg_id = data.get("id", str(uuid.uuid4()))

    session = get_or_create_session(session_id)
    with session.lock:
        try:
            session.ensure_initialized()
            session.send_message({"type": "eval", "id": msg_id, "expr": expr})

            stdout_lines = []
            stderr_lines = []
            while True:
                resp = session.read_line()
                if resp is None:
                    return jsonify({"type": "error", "id": msg_id, "error": "Worker process died"}), 500
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

        except Exception as e:
            return jsonify({"type": "error", "id": msg_id, "error": str(e)}), 500


@app.route("/api/stream", methods=["POST"])
def api_stream():
    """Start a streaming simulation, returning results as SSE."""
    session_id = _get_session_id()
    data = request.get_json(force=True)
    expr = data.get("expr", "")
    msg_id = data.get("id", str(uuid.uuid4()))

    session = get_or_create_session(session_id)

    def generate():
        with session.lock:
            try:
                session.ensure_initialized()
                session.send_message({"type": "stream-start", "id": msg_id, "expr": expr})

                while True:
                    resp = session.read_line()
                    if resp is None:
                        yield f"event: error\ndata: {json.dumps({'error': 'Worker process died'})}\n\n"
                        break
                    resp_type = resp.get("type")

                    if resp_type == "stream-data":
                        yield f"event: data\ndata: {json.dumps({'done': False, 'result': json.loads(resp.get('value', '{}'))})}\n\n"
                    elif resp_type == "stream-done":
                        yield f"event: done\ndata: {{}}\n\n"
                        break
                    elif resp_type == "stdout":
                        yield f"event: stdout\ndata: {json.dumps(resp.get('value', ''))}\n\n"
                    elif resp_type == "stderr":
                        yield f"event: stderr\ndata: {json.dumps(resp.get('value', ''))}\n\n"
                    elif resp_type == "error":
                        yield f"event: error\ndata: {json.dumps({'error': resp.get('error', ''), 'traceback': resp.get('traceback', '')})}\n\n"
                        break

            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)})}\n\n"

    return Response(
        generate(),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.route("/api/stream/exec", methods=["POST"])
def api_stream_exec():
    """Queue code to execute during an active stream."""
    session_id = _get_session_id()
    data = request.get_json(force=True)
    code = data.get("code", "")

    session = get_or_create_session(session_id)
    try:
        session.send_message({"type": "stream-exec", "code": code})
        return jsonify({"status": "queued"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/stream/stop", methods=["POST"])
def api_stream_stop():
    """Stop an active streaming session."""
    session_id = _get_session_id()

    session = get_or_create_session(session_id)
    try:
        session.send_message({"type": "stream-stop"})
        return jsonify({"status": "stopped"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/session", methods=["DELETE"])
def api_session_delete():
    """Kill a session's worker subprocess."""
    session_id = _get_session_id()
    remove_session(session_id)
    return jsonify({"status": "terminated"})


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
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    debug = os.environ.get("FLASK_DEBUG", "1") == "1"
    print(f"PathView Flask backend starting on port {port}")
    app.run(host="0.0.0.0", port=port, debug=debug, threaded=True)
