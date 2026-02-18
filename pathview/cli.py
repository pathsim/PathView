"""CLI entry point for the pathview command."""

import argparse
import sys
import threading
import time
import webbrowser
from pathlib import Path

from pathview import __version__


def _cmd_serve(args):
    """Run the PathView server."""
    from pathview.app import create_app

    app = create_app(serve_static=not args.debug)

    if not args.no_browser:
        def open_browser_when_ready():
            import urllib.request
            health_url = f"http://{args.host}:{args.port}/api/health"
            deadline = time.time() + 10
            while time.time() < deadline:
                try:
                    urllib.request.urlopen(health_url, timeout=1)
                    webbrowser.open(f"http://{args.host}:{args.port}")
                    return
                except Exception:
                    time.sleep(0.2)

        threading.Thread(target=open_browser_when_ready, daemon=True).start()

    print(f"PathView v{__version__}")
    print(f"  Python: {sys.executable}")
    print(f"Running at http://{args.host}:{args.port}")

    if args.host == "0.0.0.0":
        print("\nWARNING: Binding to 0.0.0.0 makes the server accessible on your network.")
        print("         There is no authentication — anyone on your network can execute Python code.")
        print("         Only use this on trusted networks.")

    print("\nPress Ctrl+C to stop\n")

    try:
        if args.debug:
            app.run(host=args.host, port=args.port, debug=True, threaded=True)
        else:
            import logging
            logging.getLogger("waitress.queue").setLevel(logging.ERROR)
            from waitress import serve
            serve(app, host=args.host, port=args.port, threads=4)
    except KeyboardInterrupt:
        print("\nStopping PathView server...")
        sys.exit(0)


def _cmd_convert(args):
    """Convert a .pvm file to a Python script."""
    from pathview.converter import convert

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: Input file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    registry_path = Path(args.registry) if args.registry else None
    python_code = convert(input_path, registry_path=registry_path)

    if args.stdout:
        sys.stdout.buffer.write(python_code.encode("utf-8"))
    else:
        output_path = Path(args.output) if args.output else input_path.with_suffix(".py")
        output_path.write_text(python_code, encoding="utf-8")
        print(f"Converted: {input_path} -> {output_path}")


def main():
    parser = argparse.ArgumentParser(
        prog="pathview",
        description="PathView — visual node editor for dynamic systems",
    )
    parser.add_argument("--version", action="version",
                        version=f"pathview {__version__}")

    subparsers = parser.add_subparsers(dest="command")

    # --- serve ---
    serve_parser = subparsers.add_parser("serve", help="Start the PathView server")
    serve_parser.add_argument("--port", type=int, default=5000,
                              help="Port to run the server on (default: 5000)")
    serve_parser.add_argument("--host", type=str, default="127.0.0.1",
                              help="Host to bind to (default: 127.0.0.1)")
    serve_parser.add_argument("--no-browser", action="store_true",
                              help="Don't automatically open the browser")
    serve_parser.add_argument("--debug", action="store_true",
                              help="Run in debug mode")

    # --- convert ---
    convert_parser = subparsers.add_parser(
        "convert",
        help="Convert a .pvm file to a Python script",
    )
    convert_parser.add_argument("input", help="Input .pvm or .json file")
    convert_parser.add_argument("-o", "--output",
                                help="Output .py file (default: <input>.py)")
    convert_parser.add_argument("--stdout", action="store_true",
                                help="Print to stdout instead of file")
    convert_parser.add_argument("--registry",
                                help="Path to custom registry.json")

    args = parser.parse_args()

    if args.command is None or args.command == "serve":
        if args.command is None:
            # Re-parse with serve defaults when no subcommand given
            args = serve_parser.parse_args([])
        _cmd_serve(args)
    elif args.command == "convert":
        _cmd_convert(args)


if __name__ == "__main__":
    main()
