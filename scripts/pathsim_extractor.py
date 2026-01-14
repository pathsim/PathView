#!/usr/bin/env python3
"""
PathSim Metadata Extractor
Shared utilities for extracting metadata from PathSim classes.

Used by:
- extract-blocks.py
- extract-events.py
- extract-simulation.py
"""

import inspect
import json
import re
import sys
from pathlib import Path
from typing import Any

# Add PathSim to path
PATHSIM_PATH = Path(__file__).parent.parent.parent / "pathsim" / "src"
if PATHSIM_PATH.exists():
    sys.path.insert(0, str(PATHSIM_PATH))

# Optional docutils for RST to HTML conversion
try:
    from docutils.core import publish_parts
    HAS_DOCUTILS = True
except ImportError:
    HAS_DOCUTILS = False


def rst_to_html(rst_text: str) -> str:
    """Convert RST docstring to HTML, preserving LaTeX math for KaTeX rendering."""
    if not rst_text or not HAS_DOCUTILS:
        return ""

    try:
        parts = publish_parts(
            rst_text,
            writer_name="html",
            settings_overrides={
                "report_level": 5,
                "halt_level": 5,
                "initial_header_level": 3,
                "math_output": "MathJax",
            }
        )
        return parts["body"]
    except Exception as e:
        print(f"Warning: Failed to convert docstring to HTML: {e}")
        return ""


def extract_first_line(docstring: str) -> str:
    """Extract first line/sentence from docstring as description."""
    if not docstring:
        return ""

    lines = docstring.strip().split("\n")
    first_line = ""
    for line in lines:
        stripped = line.strip()
        if stripped:
            first_line = stripped
            break

    if ". " in first_line:
        first_line = first_line.split(". ")[0] + "."

    return first_line


def extract_param_description(docstring: str, param_name: str) -> str:
    """Extract parameter description from docstring (RST format)."""
    if not docstring:
        return ""

    # Stop at next param (indented or not), blank line, or end
    pattern = rf"{param_name}\s*:\s*[^\n]*\n\s+(.+?)(?=\n\s*\w+\s*:|\n\n|$)"
    match = re.search(pattern, docstring, re.DOTALL)
    if match:
        desc = match.group(1).strip()
        desc = re.sub(r"\s+", " ", desc)
        return desc

    return ""


def infer_param_type(value: Any, param_name: str = "") -> str:
    """Infer parameter type from default value.

    Returns one of: 'number', 'integer', 'boolean', 'string', 'array', 'callable', 'any'
    """
    # Check param name for callable hints
    if param_name.startswith('func_') or param_name.startswith('func'):
        return "callable"
    if callable(value) and not isinstance(value, type):
        return "callable"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, (list, tuple)):
        return "array"
    if value is None:
        return "any"
    return "any"


def format_default_ts(value: Any) -> str | None:
    """Format default value for TypeScript (JavaScript-style)."""
    if value is None:
        return None
    if callable(value) and not isinstance(value, type):
        return None  # Callables can't be serialized
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return f'"{value}"'
    if isinstance(value, (list, tuple)):
        return json.dumps(list(value))
    if isinstance(value, type):
        return f'"{value.__name__}"'
    return repr(value)


def format_default_py(value: Any) -> str | None:
    """Format default value as Python expression string."""
    if value is None:
        return None
    if callable(value) and not isinstance(value, type):
        try:
            source = inspect.getsource(value).strip()
            if "lambda" in source:
                match = re.search(r'(lambda[^,\)]+)', source)
                if match:
                    return match.group(1)
        except:
            pass
        return None
    if isinstance(value, bool):
        return "True" if value else "False"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return f'"{value}"'
    if isinstance(value, (list, tuple)):
        return repr(list(value))
    if isinstance(value, type):
        return value.__name__
    return repr(value)


def extract_class_params(cls, skip_params: list[str] = None) -> list[dict]:
    """Extract parameter metadata from a class's __init__ method.

    Args:
        cls: The class to extract parameters from
        skip_params: Parameter names to skip (e.g., ['self'])

    Returns:
        List of parameter info dicts with keys: name, type, default, default_py, description
    """
    skip_params = skip_params or ['self']

    try:
        sig = inspect.signature(cls.__init__)
    except (ValueError, TypeError):
        return []

    docstring = cls.__doc__ or ""
    params = []

    for name, param in sig.parameters.items():
        if name in skip_params:
            continue

        default = None if param.default is inspect.Parameter.empty else param.default
        param_type = infer_param_type(default, name)

        params.append({
            "name": name,
            "type": param_type,
            "default": format_default_ts(default),
            "default_py": format_default_py(default),
            "description": extract_param_description(docstring, name),
        })

    return params


def extract_class_metadata(cls) -> dict:
    """Extract full metadata from a PathSim class.

    Returns:
        Dict with keys: name, description, docstring_html, params
    """
    docstring = cls.__doc__ or ""

    return {
        "name": cls.__name__,
        "description": extract_first_line(docstring),
        "docstring_html": rst_to_html(docstring),
        "params": extract_class_params(cls),
    }
