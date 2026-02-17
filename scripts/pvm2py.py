#!/usr/bin/env python3
"""
PVM to Python Converter (CLI wrapper)

Converts PathView .pvm/.json files to standalone PathSim Python scripts.

Usage:
    python scripts/pvm2py.py model.pvm                # outputs model.py
    python scripts/pvm2py.py model.pvm -o output.py   # custom output path
    python scripts/pvm2py.py model.pvm --stdout        # print to stdout
"""

import argparse
import sys
from pathlib import Path

from pathview.converter import generate_python, load_registry


def main():
    parser = argparse.ArgumentParser(
        description="Convert PathView .pvm files to standalone PathSim Python scripts",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/pvm2py.py model.pvm
  python scripts/pvm2py.py model.pvm -o simulation.py
  python scripts/pvm2py.py model.pvm --stdout
""",
    )
    parser.add_argument("input", help="Input .pvm or .json file")
    parser.add_argument("-o", "--output", help="Output .py file (default: <input>.py)")
    parser.add_argument("--stdout", action="store_true", help="Print to stdout instead of file")
    parser.add_argument(
        "--registry",
        help="Path to registry.json (default: scripts/generated/registry.json)",
    )
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    # Load registry
    if args.registry:
        registry_path = Path(args.registry)
    else:
        registry_path = Path(__file__).parent / "generated" / "registry.json"
    registry = load_registry(registry_path)

    # Load .pvm file
    import json
    with open(input_path, encoding="utf-8") as f:
        pvm = json.load(f)

    # Generate Python code
    python_code = generate_python(pvm, registry, source_name=input_path.name)

    if args.stdout:
        sys.stdout.buffer.write(python_code.encode("utf-8"))
    else:
        if args.output:
            output_path = Path(args.output)
        else:
            output_path = input_path.with_suffix(".py")
        output_path.write_text(python_code, encoding="utf-8")
        print(f"Converted: {input_path} -> {output_path}")


if __name__ == "__main__":
    main()
