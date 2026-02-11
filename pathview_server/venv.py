"""Virtual environment management for PathView worker subprocesses.

Creates and manages a dedicated venv at ~/.pathview/venv so that simulation
dependencies (pathsim, pathsim-chem, numpy, etc.) are installed in isolation
rather than polluting the user's global/active environment.
"""

import subprocess
import sys
from pathlib import Path

VENV_DIR = Path.home() / ".pathview" / "venv"


def get_venv_python() -> str:
    """Return path to the venv's Python executable."""
    if sys.platform == "win32":
        return str(VENV_DIR / "Scripts" / "python.exe")
    return str(VENV_DIR / "bin" / "python")


def ensure_venv() -> str:
    """Create the venv if it doesn't exist. Returns venv Python path."""
    python = get_venv_python()
    if Path(python).exists():
        return python

    print("Creating PathView virtual environment...")
    VENV_DIR.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([sys.executable, "-m", "venv", str(VENV_DIR)], check=True)
    # Upgrade pip in the venv
    subprocess.run([python, "-m", "pip", "install", "--upgrade", "pip", "--quiet"], check=True)
    print(f"  Virtual environment created at {VENV_DIR}")
    return python
