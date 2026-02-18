"""Shared configuration constants for the PathView backend."""

from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------

WORKER_SCRIPT = str(Path(__file__).parent / "worker.py")

# ---------------------------------------------------------------------------
# Timeouts (seconds)
# ---------------------------------------------------------------------------

EXEC_TIMEOUT = 30       # Per exec/eval call in the worker
SERVER_TIMEOUT = 35     # Server-side read timeout (slightly > worker's EXEC_TIMEOUT)
INIT_TIMEOUT = 120      # Initialization / pip install (matches frontend TIMEOUTS.INIT)

# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

SESSION_TTL = 3600      # Inactive session cleanup after 1 hour
CLEANUP_INTERVAL = 60   # Check for stale sessions every 60 seconds
