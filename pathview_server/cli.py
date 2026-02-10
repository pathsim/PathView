"""CLI entry point for the pathview command."""

import argparse
import sys
import threading
import time
import webbrowser

from pathview_server import __version__


def main():
    parser = argparse.ArgumentParser(
        prog="pathview",
        description="PathView — visual node editor for dynamic systems",
    )
    parser.add_argument("command", nargs="?", default="serve", choices=["serve"],
                        help="Command to run (default: serve)")
    parser.add_argument("--port", type=int, default=5000,
                        help="Port to run the server on (default: 5000)")
    parser.add_argument("--host", type=str, default="127.0.0.1",
                        help="Host to bind to (default: 127.0.0.1)")
    parser.add_argument("--no-browser", action="store_true",
                        help="Don't automatically open the browser")
    parser.add_argument("--debug", action="store_true",
                        help="Run in debug mode")
    parser.add_argument("--version", action="version",
                        version=f"pathview {__version__}")

    args = parser.parse_args()

    from pathview_server.app import create_app

    app = create_app(serve_static=True)

    if not args.no_browser:
        def open_browser():
            time.sleep(1.5)
            webbrowser.open(f"http://{args.host}:{args.port}")

        threading.Thread(target=open_browser, daemon=True).start()

    print(f"PathView v{__version__}")
    print(f"Running at http://{args.host}:{args.port}")
    print("Press Ctrl+C to stop\n")

    try:
        app.run(host=args.host, port=args.port, debug=args.debug, threaded=True)
    except KeyboardInterrupt:
        print("\nStopping PathView server...")
        sys.exit(0)


if __name__ == "__main__":
    main()
