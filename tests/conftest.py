"""Shared pytest fixtures for PathView server tests."""

import pytest

from pathview.app import create_app, _sessions, _sessions_lock


@pytest.fixture()
def app():
    """Create a Flask test app (API-only, no static serving)."""
    application = create_app(serve_static=False)
    application.config["TESTING"] = True
    yield application
    # Clean up all sessions after each test
    with _sessions_lock:
        for session in _sessions.values():
            session.kill()
        _sessions.clear()


@pytest.fixture()
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture()
def session_id():
    """A stable session ID for tests."""
    return "test-session-001"


@pytest.fixture()
def session_headers(session_id):
    """Headers with session ID and content type."""
    return {
        "X-Session-ID": session_id,
        "Content-Type": "application/json",
    }
