"""Unit tests for the worker subprocess message protocol."""

import json
import subprocess
import sys
from pathlib import Path

WORKER_SCRIPT = str(Path(__file__).parent.parent / "pathview_server" / "worker.py")


def _start_worker():
    """Start a worker subprocess and return it."""
    return subprocess.Popen(
        [sys.executable, "-u", WORKER_SCRIPT],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
    )


def _send(proc, msg):
    """Send a JSON message to the worker."""
    proc.stdin.write(json.dumps(msg) + "\n")
    proc.stdin.flush()


def _recv(proc):
    """Read one JSON response from the worker."""
    line = proc.stdout.readline()
    if not line:
        return None
    return json.loads(line.strip())


def _recv_until(proc, target_type, target_id=None):
    """Read messages until we get the target type. Returns (target_msg, other_msgs)."""
    others = []
    while True:
        msg = _recv(proc)
        if msg is None:
            raise RuntimeError("Worker died unexpectedly")
        if msg.get("type") == target_type and (target_id is None or msg.get("id") == target_id):
            return msg, others
        others.append(msg)


def test_init_ready():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        msg, _ = _recv_until(proc, "ready")
        assert msg["type"] == "ready"
    finally:
        proc.kill()
        proc.wait()


def test_exec_ok():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        _send(proc, {"type": "exec", "id": "e1", "code": "x = 10"})
        msg, _ = _recv_until(proc, "ok", "e1")
        assert msg["type"] == "ok"
        assert msg["id"] == "e1"
    finally:
        proc.kill()
        proc.wait()


def test_exec_error():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        _send(proc, {"type": "exec", "id": "e2", "code": "1/0"})
        msg, _ = _recv_until(proc, "error", "e2")
        assert msg["type"] == "error"
        assert "ZeroDivisionError" in msg.get("traceback", "")
    finally:
        proc.kill()
        proc.wait()


def test_eval_value():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        _send(proc, {"type": "exec", "id": "e3", "code": "z = 42"})
        _recv_until(proc, "ok", "e3")

        _send(proc, {"type": "eval", "id": "v1", "expr": "z"})
        msg, _ = _recv_until(proc, "value", "v1")
        assert json.loads(msg["value"]) == 42
    finally:
        proc.kill()
        proc.wait()


def test_eval_error():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        _send(proc, {"type": "eval", "id": "v2", "expr": "undefined_variable"})
        msg, _ = _recv_until(proc, "error", "v2")
        assert msg["type"] == "error"
        assert "NameError" in msg.get("traceback", "") or "undefined_variable" in msg.get("error", "")
    finally:
        proc.kill()
        proc.wait()


def test_exec_print_captured():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        _send(proc, {"type": "exec", "id": "e4", "code": "print('captured')"})
        msg, others = _recv_until(proc, "ok", "e4")
        stdout_msgs = [m for m in others if m.get("type") == "stdout"]
        assert any("captured" in m.get("value", "") for m in stdout_msgs)
    finally:
        proc.kill()
        proc.wait()


def test_exec_before_init():
    proc = _start_worker()
    try:
        _send(proc, {"type": "exec", "id": "e5", "code": "x = 1"})
        msg, _ = _recv_until(proc, "error", "e5")
        assert "not initialized" in msg["error"].lower()
    finally:
        proc.kill()
        proc.wait()


def test_double_init():
    proc = _start_worker()
    try:
        _send(proc, {"type": "init"})
        _recv_until(proc, "ready")

        # Second init should just return ready immediately
        _send(proc, {"type": "init"})
        msg, _ = _recv_until(proc, "ready")
        assert msg["type"] == "ready"
    finally:
        proc.kill()
        proc.wait()
