"""Integration tests for Flask routes."""

import json


def test_health(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "ok"


def test_init_missing_session_id(client):
    resp = client.post("/api/init", json={})
    assert resp.status_code == 400
    assert "Missing X-Session-ID" in resp.get_json()["error"]


def test_init_creates_session(client, session_headers):
    resp = client.post("/api/init", json={"packages": []}, headers=session_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["type"] == "ready"


def test_exec_simple(client, session_headers):
    # Init first
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    # Execute code
    resp = client.post("/api/exec", json={"code": "x = 42"}, headers=session_headers)
    assert resp.status_code == 200
    assert resp.get_json()["type"] == "ok"


def test_exec_with_print(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    resp = client.post(
        "/api/exec", json={"code": "print('hello world')"}, headers=session_headers
    )
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["type"] == "ok"
    assert "hello world" in data.get("stdout", "")


def test_exec_error(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    resp = client.post(
        "/api/exec", json={"code": "raise ValueError('test error')"}, headers=session_headers
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["type"] == "error"
    assert "test error" in data["error"]


def test_eval_simple(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    # Set a variable, then eval it
    client.post("/api/exec", json={"code": "y = 123"}, headers=session_headers)

    resp = client.post("/api/eval", json={"expr": "y"}, headers=session_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["type"] == "value"
    assert json.loads(data["value"]) == 123


def test_eval_expression(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    resp = client.post("/api/eval", json={"expr": "2 + 3"}, headers=session_headers)
    assert resp.status_code == 200
    data = resp.get_json()
    assert json.loads(data["value"]) == 5


def test_eval_error(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    resp = client.post(
        "/api/eval", json={"expr": "undefined_var"}, headers=session_headers
    )
    assert resp.status_code == 400
    data = resp.get_json()
    assert data["type"] == "error"


def test_session_delete(client, session_headers):
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    resp = client.delete("/api/session", headers=session_headers)
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "terminated"


def test_session_persistence(client, session_headers):
    """Variables set in one exec should be available in the next."""
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    client.post("/api/exec", json={"code": "my_var = 'persistent'"}, headers=session_headers)

    resp = client.post("/api/eval", json={"expr": "my_var"}, headers=session_headers)
    data = resp.get_json()
    assert json.loads(data["value"]) == "persistent"


def test_streaming_lifecycle(client, session_headers):
    """Test stream start → poll → done cycle."""
    client.post("/api/init", json={"packages": []}, headers=session_headers)

    # Set up a generator that yields one value then is done
    client.post(
        "/api/exec",
        json={"code": "_step = 0\ndef _gen():\n    global _step\n    _step += 1\n    return {'result': _step, 'done': _step >= 2}"},
        headers=session_headers,
    )

    # Start streaming
    resp = client.post(
        "/api/stream/start",
        json={"expr": "_gen()"},
        headers=session_headers,
    )
    assert resp.status_code == 200
    assert resp.get_json()["status"] == "started"

    # Poll until done
    import time
    done = False
    messages = []
    deadline = time.time() + 10
    while not done and time.time() < deadline:
        resp = client.post("/api/stream/poll", headers=session_headers)
        data = resp.get_json()
        messages.extend(data.get("messages", []))
        done = data.get("done", False)
        if not done:
            time.sleep(0.1)

    assert done
    types = [m["type"] for m in messages]
    assert "stream-data" in types
    assert "stream-done" in types


def test_exec_missing_session_id(client):
    resp = client.post("/api/exec", json={"code": "pass"})
    assert resp.status_code == 400


def test_eval_missing_session_id(client):
    resp = client.post("/api/eval", json={"expr": "1"})
    assert resp.status_code == 400
