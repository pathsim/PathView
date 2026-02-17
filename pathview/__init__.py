"""PathView — local Flask backend and PVM converter for PathView."""

try:
    from importlib.metadata import version
    __version__ = version("pathview")
except Exception:
    __version__ = "0.5.0"  # fallback for editable installs / dev

from pathview.converter import convert
