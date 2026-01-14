#!/usr/bin/env python3
"""
PathSim Event Extractor
Extracts event metadata from PathSim and generates TypeScript definitions.

Run: python scripts/extract-events.py
Output: src/lib/events/generated/events.ts
"""

import inspect
import json
import re
import sys
from pathlib import Path
from typing import Any

# Add PathSim to path if needed
PATHSIM_PATH = Path(__file__).parent.parent.parent / "pathsim" / "src"
if PATHSIM_PATH.exists():
    sys.path.insert(0, str(PATHSIM_PATH))

try:
    from docutils.core import publish_parts
    HAS_DOCUTILS = True
except ImportError:
    HAS_DOCUTILS = False
    print("Warning: docutils not installed, docstrings will not be converted to HTML")

# Import PathSim events
from pathsim.events import (
    ZeroCrossing,
    ZeroCrossingUp,
    ZeroCrossingDown,
    Schedule,
    ScheduleList,
    Condition,
)

# Event classes to extract
EVENT_CLASSES = {
    "ZeroCrossing": ZeroCrossing,
    "ZeroCrossingUp": ZeroCrossingUp,
    "ZeroCrossingDown": ZeroCrossingDown,
    "Schedule": Schedule,
    "ScheduleList": ScheduleList,
    "Condition": Condition,
}


def rst_to_html(rst_text: str) -> str:
    """Convert RST docstring to HTML, preserving LaTeX math for KaTeX rendering."""
    if not rst_text or not HAS_DOCUTILS:
        return ""

    try:
        parts = publish_parts(
            rst_text,
            writer_name="html",
            settings_overrides={
                "report_level": 5,  # Suppress warnings
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


def infer_param_type(value: Any, param_name: str) -> str:
    """Infer parameter type from default value.

    Maps to EventParamType: 'number' | 'string' | 'callable' | 'array'
    """
    # Check param name for callable hints
    if param_name.startswith('func_'):
        return "callable"
    if callable(value):
        return "callable"
    if isinstance(value, bool):
        return "number"  # bool treated as number in TS
    if isinstance(value, (int, float)):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, (list, tuple)):
        return "array"
    if param_name.endswith('_evt') and 'time' in param_name.lower():
        return "array"  # times_evt is an array
    # Default to callable for None values that look like functions
    if value is None and param_name.startswith('func'):
        return "callable"
    if value is None and param_name == 'times_evt':
        return "array"
    return "number"  # default to number for tolerance, t_start, etc.


def format_default(value: Any) -> str | None:
    """Format default value for TypeScript."""
    if value is None:
        return "None"
    if callable(value):
        # Try to get the source code for lambda functions
        try:
            source = inspect.getsource(value).strip()
            # Extract just the lambda part
            if "lambda" in source:
                match = re.search(r'(lambda[^,\)]+)', source)
                if match:
                    return match.group(1)
        except:
            pass
        return "lambda t: None"
    if isinstance(value, bool):
        return "True" if value else "False"
    if isinstance(value, (int, float)):
        return repr(value)
    if isinstance(value, str):
        return f'"{value}"'
    if isinstance(value, (list, tuple)):
        return repr(list(value))
    return repr(value)


def extract_param_description(docstring: str, param_name: str) -> str:
    """Extract parameter description from docstring."""
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


def extract_event(event_name: str, event_cls) -> dict | None:
    """Extract metadata from a PathSim event class."""
    try:
        sig = inspect.signature(event_cls.__init__)
        params = []
        docstring = event_cls.__doc__ or ""

        for name, param in sig.parameters.items():
            if name == "self":
                continue

            default = None if param.default is inspect.Parameter.empty else param.default
            param_type = infer_param_type(default, name)

            param_info = {
                "name": name,
                "type": param_type,
                "default": format_default(default),
                "description": extract_param_description(docstring, name),
            }

            params.append(param_info)

        return {
            "type": f"pathsim.events.{event_name}",
            "name": event_name,
            "eventClass": event_name,
            "description": extract_first_line(docstring),
            "docstringHtml": rst_to_html(docstring),
            "params": params,
        }

    except Exception as e:
        print(f"Error extracting event '{event_name}': {e}")
        return None


def generate_typescript(events: list[dict]) -> str:
    """Generate TypeScript file content."""
    lines = [
        "// Auto-generated by scripts/extract-events.py - DO NOT EDIT",
        "// Re-run 'python scripts/extract-events.py' to update",
        "",
        "import type { EventTypeDefinition } from '../types';",
        "",
        "export const extractedEvents: EventTypeDefinition[] = ",
    ]

    events_json = json.dumps(events, indent=2, ensure_ascii=False)
    lines.append(events_json + ";")
    lines.append("")

    return "\n".join(lines)


def main():
    print("Extracting PathSim events...")

    extracted_events = []
    for event_name, event_cls in EVENT_CLASSES.items():
        print(f"  Extracting {event_name}...")
        event_data = extract_event(event_name, event_cls)
        if event_data:
            extracted_events.append(event_data)

    print(f"Extracted {len(extracted_events)} events")

    ts_content = generate_typescript(extracted_events)

    output_path = Path(__file__).parent.parent / "src" / "lib" / "events" / "generated" / "events.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content, encoding="utf-8")

    print(f"Generated {output_path}")


if __name__ == "__main__":
    main()
