#!/usr/bin/env python3
"""
Build script for the PathView PyPI package.

1. Builds the SvelteKit frontend (vite build)
2. Copies build/ output to pathview/static/
3. Builds the Python wheel
"""

import json
import os
import re
import sys
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
BUILD_DIR = REPO_ROOT / "build"
STATIC_DIR = REPO_ROOT / "pathview" / "static"


def _find_npx():
    """Find the npx binary. On Windows, use npx.cmd."""
    name = "npx.cmd" if sys.platform == "win32" else "npx"
    path = shutil.which(name)
    if not path:
        print(f"ERROR: {name} not found on PATH")
        sys.exit(1)
    return path


def run(cmd, **kwargs):
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=kwargs.pop("cwd", REPO_ROOT), **kwargs)
    if result.returncode != 0:
        print(f"ERROR: command failed (exit {result.returncode})")
        sys.exit(result.returncode)


def _sync_version():
    """Read version from pyproject.toml and sync to package.json."""
    pyproject = REPO_ROOT / "pyproject.toml"
    text = pyproject.read_text()
    match = re.search(r'^version\s*=\s*"([^"]+)"', text, re.MULTILINE)
    if not match:
        print("ERROR: could not find version in pyproject.toml")
        sys.exit(1)
    version = match.group(1)

    pkg_json_path = REPO_ROOT / "package.json"
    pkg = json.loads(pkg_json_path.read_text())
    if pkg.get("version") != version:
        print(f"  Syncing version {pkg.get('version')} → {version} in package.json")
        pkg["version"] = version
        pkg_json_path.write_text(json.dumps(pkg, indent=2) + "\n")
    return version


def main():
    print("[0/4] Syncing version...")
    version = _sync_version()
    print(f"  Version: {version}")

    print("[1/4] Cleaning previous builds...")
    for d in [BUILD_DIR, STATIC_DIR, REPO_ROOT / "dist"]:
        if d.exists():
            shutil.rmtree(d)

    # Remove egg-info
    for p in REPO_ROOT.glob("*.egg-info"):
        shutil.rmtree(p)

    print("[2/4] Building SvelteKit frontend...")
    env = os.environ.copy()
    env["BASE_PATH"] = ""
    npx = _find_npx()
    run([npx, "vite", "build"], env=env)

    if not (BUILD_DIR / "index.html").exists():
        print("ERROR: build/index.html not found")
        sys.exit(1)

    print("[3/4] Copying frontend to pathview/static/...")
    shutil.copytree(BUILD_DIR, STATIC_DIR)
    print(f"  Copied {sum(1 for _ in STATIC_DIR.rglob('*') if _.is_file())} files")

    print("[4/4] Building Python wheel...")
    run([sys.executable, "-m", "build"])

    print("\nDone! Output:")
    dist = REPO_ROOT / "dist"
    if dist.exists():
        for f in sorted(dist.iterdir()):
            print(f"  {f.name}")


if __name__ == "__main__":
    main()
