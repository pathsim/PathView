#!/usr/bin/env python3
"""
Build script for the PathView PyPI package.

1. Builds the SvelteKit frontend (vite build)
2. Copies build/ output to pathview_server/static/
3. Builds the Python wheel
"""

import os
import sys
import shutil
import subprocess
from pathlib import Path

REPO_ROOT = Path(__file__).parent.parent
BUILD_DIR = REPO_ROOT / "build"
STATIC_DIR = REPO_ROOT / "pathview_server" / "static"


def run(cmd, **kwargs):
    print(f"  > {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=kwargs.pop("cwd", REPO_ROOT), **kwargs)
    if result.returncode != 0:
        print(f"ERROR: command failed (exit {result.returncode})")
        sys.exit(result.returncode)


def main():
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
    run(["npx", "vite", "build"], env=env)

    if not (BUILD_DIR / "index.html").exists():
        print("ERROR: build/index.html not found")
        sys.exit(1)

    print("[3/4] Copying frontend to pathview_server/static/...")
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
