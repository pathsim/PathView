#!/usr/bin/env python3
"""
PathSim Block Extractor
Extracts block metadata from PathSim and generates TypeScript definitions.

Run: python scripts/extract-blocks.py
Output: src/lib/nodes/generated/blocks.ts
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

# Import PathSim blocks
from pathsim.blocks import *
from pathsim.subsystem import Subsystem, Interface


# Block configuration - defines which blocks to extract and their categories
BLOCK_CONFIG = {
    "Sources": [
        "Constant",
        "Source",
        "SinusoidalSource",
        "StepSource",
        "PulseSource",
        "TriangleWaveSource",
        "SquareWaveSource",
        "GaussianPulseSource",
        "ChirpPhaseNoiseSource",
        "ClockSource",
        "WhiteNoise",
        "PinkNoise",
        "RandomNumberGenerator",
    ],
    "Dynamic": [
        "Integrator",
        "Differentiator",
        "Delay",
        "ODE",
        "DynamicalSystem",
        "StateSpace",
        "PID",
        "AntiWindupPID",
        "TransferFunctionNumDen",
        "TransferFunctionZPG",
        "ButterworthLowpassFilter",
        "ButterworthHighpassFilter",
        "ButterworthBandpassFilter",
        "ButterworthBandstopFilter",
    ],
    "Algebraic": [
        "Adder",
        "Multiplier",
        "Amplifier",
        "Function",
        "Sin",
        "Cos",
        "Tan",
        "Tanh",
        "Abs",
        "Sqrt",
        "Exp",
        "Log",
        "Log10",
        "Mod",
        "Clip",
        "Pow",
        "Switch",
        "LUT",
        "LUT1D",
    ],
    "Mixed": [
        "SampleHold",
        "FIR",
        "ADC",
        "DAC",
        "Counter",
        "CounterUp",
        "CounterDown",
        "Relay",
    ],
    "Recording": [
        "Scope",
        "Spectrum",
    ],
    # Subsystem blocks are manually defined in subsystem.ts but we still extract their docstrings
}

# Extra blocks to extract docstrings from, but not auto-register
EXTRA_DOCSTRINGS = ["Subsystem", "Interface"]

# UI-specific overrides that can't be introspected from PathSim
UI_OVERRIDES = {
    # Sources - no inputs, single output
    "Constant": {"maxInputs": 0, "maxOutputs": 1},
    "Source": {"maxInputs": 0, "maxOutputs": 1},
    "SinusoidalSource": {"maxInputs": 0, "maxOutputs": 1},
    "StepSource": {"maxInputs": 0, "maxOutputs": 1},
    "PulseSource": {"maxInputs": 0, "maxOutputs": 1},
    "TriangleWaveSource": {"maxInputs": 0, "maxOutputs": 1},
    "SquareWaveSource": {"maxInputs": 0, "maxOutputs": 1},
    "GaussianPulseSource": {"maxInputs": 0, "maxOutputs": 1},
    "ClockSource": {"maxInputs": 0, "maxOutputs": 1},
    "WhiteNoise": {"maxInputs": 0, "maxOutputs": 1},
    "PinkNoise": {"maxInputs": 0, "maxOutputs": 1},
    "ChirpPhaseNoiseSource": {"maxInputs": 0, "maxOutputs": 1},
    "RandomNumberGenerator": {"maxInputs": 0, "maxOutputs": 1},

    # Dynamic - vector passthrough (unlimited) unless specified
    "Integrator": {"maxInputs": None, "maxOutputs": None},
    "Differentiator": {"maxInputs": None, "maxOutputs": None},
    "Delay": {"maxInputs": None, "maxOutputs": None},
    "ODE": {"maxInputs": None, "maxOutputs": None},
    "DynamicalSystem": {"maxInputs": None, "maxOutputs": None},
    "StateSpace": {"maxInputs": None, "maxOutputs": None},
    "PID": {"maxInputs": 1, "maxOutputs": 1},
    "AntiWindupPID": {"maxInputs": 1, "maxOutputs": 1},
    "TransferFunctionNumDen": {"maxInputs": 1, "maxOutputs": 1},
    "TransferFunctionZPG": {"maxInputs": 1, "maxOutputs": 1},
    "ButterworthLowpassFilter": {"maxInputs": None, "maxOutputs": None},
    "ButterworthHighpassFilter": {"maxInputs": None, "maxOutputs": None},
    "ButterworthBandpassFilter": {"maxInputs": None, "maxOutputs": None},
    "ButterworthBandstopFilter": {"maxInputs": None, "maxOutputs": None},

    # Algebraic
    "Adder": {"maxInputs": None, "maxOutputs": 1},
    "Multiplier": {"maxInputs": None, "maxOutputs": 1},
    "Amplifier": {"maxInputs": None, "maxOutputs": None},
    "Function": {"maxInputs": None, "maxOutputs": None},
    "Sin": {"maxInputs": None, "maxOutputs": None},
    "Cos": {"maxInputs": None, "maxOutputs": None},
    "Tan": {"maxInputs": None, "maxOutputs": None},
    "Tanh": {"maxInputs": None, "maxOutputs": None},
    "Abs": {"maxInputs": None, "maxOutputs": None},
    "Sqrt": {"maxInputs": None, "maxOutputs": None},
    "Exp": {"maxInputs": None, "maxOutputs": None},
    "Log": {"maxInputs": None, "maxOutputs": None},
    "Log10": {"maxInputs": None, "maxOutputs": None},
    "Mod": {"maxInputs": None, "maxOutputs": None},
    "Clip": {"maxInputs": None, "maxOutputs": None},
    "Pow": {"maxInputs": None, "maxOutputs": None},
    "Switch": {"maxInputs": None, "maxOutputs": 1},
    "LUT": {"maxInputs": None, "maxOutputs": None},
    "LUT1D": {"maxInputs": 1, "maxOutputs": 1},

    # Mixed
    "SampleHold": {},
    "FIR": {},
    "ADC": {},
    "DAC": {},
    "Counter": {"maxInputs": 1, "maxOutputs": 1},
    "CounterUp": {"maxInputs": 1, "maxOutputs": 1},
    "CounterDown": {"maxInputs": 1, "maxOutputs": 1},
    "Relay": {"maxInputs": 1, "maxOutputs": 1},

    # Recording - unlimited inputs, no outputs
    "Scope": {"maxInputs": None, "maxOutputs": 0},
    "Spectrum": {"maxInputs": None, "maxOutputs": 0},

}

# Parameter overrides - PathSim handles all validation at runtime
PARAM_OVERRIDES: dict[str, dict] = {}


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
                # Use MathJax output mode to preserve LaTeX in <span class="math">
                # This allows client-side KaTeX rendering
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

    # Get first non-empty line
    lines = docstring.strip().split("\n")
    first_line = ""
    for line in lines:
        stripped = line.strip()
        if stripped:
            first_line = stripped
            break

    # Truncate at first period if present
    if ". " in first_line:
        first_line = first_line.split(". ")[0] + "."

    return first_line


def infer_param_type(value: Any) -> str:
    """Infer parameter type from default value."""
    if value is None:
        return "any"
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
    if callable(value):
        return "callable"
    return "any"


def format_default(value: Any) -> str | None:
    """Format default value for TypeScript."""
    if value is None:
        return None
    if callable(value):
        return None  # Callables can't be serialized
    if isinstance(value, bool):
        return "true" if value else "false"
    if isinstance(value, (int, float)):
        # Keep numeric format from Python
        return repr(value)
    if isinstance(value, str):
        return f'"{value}"'
    if isinstance(value, (list, tuple)):
        return json.dumps(list(value))
    return repr(value)


def extract_param_description(docstring: str, param_name: str) -> str:
    """Extract parameter description from docstring."""
    if not docstring:
        return ""

    # Look for parameter in docstring (RST format)
    # Pattern: param_name : type\n    description
    # Stop at next param (indented or not), blank line, or end
    pattern = rf"{param_name}\s*:\s*[^\n]*\n\s+(.+?)(?=\n\s*\w+\s*:|\n\n|$)"
    match = re.search(pattern, docstring, re.DOTALL)
    if match:
        desc = match.group(1).strip()
        # Clean up multi-line descriptions
        desc = re.sub(r"\s+", " ", desc)
        return desc

    return ""


def extract_block(block_name: str) -> dict | None:
    """Extract metadata from a PathSim block class."""
    try:
        cls = globals().get(block_name)
        if cls is None:
            print(f"Warning: Block '{block_name}' not found")
            return None

        # Get __init__ signature
        sig = inspect.signature(cls.__init__)

        # Extract parameters
        params = {}
        docstring = cls.__doc__ or ""

        for name, param in sig.parameters.items():
            if name == "self":
                continue

            default = None if param.default is inspect.Parameter.empty else param.default
            param_type = infer_param_type(default)

            param_info = {
                "type": param_type,
                "default": format_default(default),
                "description": extract_param_description(docstring, name),
            }

            # Apply parameter overrides
            if block_name in PARAM_OVERRIDES and name in PARAM_OVERRIDES[block_name]:
                param_info.update(PARAM_OVERRIDES[block_name][name])

            params[name] = param_info

        # Get port mappings by instantiating the block
        try:
            # Some blocks need arguments, try with defaults first
            instance = cls()
            # Register stores mapping in _mapping (private attribute)
            inputs = list(getattr(instance.inputs, "_mapping", {}).keys()) if hasattr(instance, "inputs") else []
            outputs = list(getattr(instance.outputs, "_mapping", {}).keys()) if hasattr(instance, "outputs") else []
        except Exception:
            # Fallback: just use empty ports, UI overrides will provide defaults
            inputs = []
            outputs = []

        return {
            "blockClass": block_name,
            "description": extract_first_line(docstring),
            "docstringHtml": rst_to_html(docstring),
            "params": params,
            "inputs": inputs,
            "outputs": outputs,
        }

    except Exception as e:
        print(f"Error extracting block '{block_name}': {e}")
        return None


def generate_typescript(blocks: dict[str, dict], config: dict[str, list[str]], overrides: dict) -> str:
    """Generate TypeScript file content."""
    lines = [
        "// Auto-generated by scripts/extract-blocks.py - DO NOT EDIT",
        "// Re-run 'python scripts/extract-blocks.py' to update",
        "",
        "import type { NodeCategory } from '../types';",
        "",
        "export interface ExtractedParam {",
        "  type: string;",
        "  default: string | null;",
        "  description: string;",
        "  min?: number;",
        "  max?: number;",
        "  options?: string[];",
        "}",
        "",
        "export interface ExtractedBlock {",
        "  blockClass: string;",
        "  description: string;",
        "  docstringHtml: string;",
        "  params: Record<string, ExtractedParam>;",
        "  inputs: string[];",
        "  outputs: string[];",
        "}",
        "",
        "export interface UIOverride {",
        "  maxInputs?: number | null;",
        "  maxOutputs?: number | null;",
        "  defaultInputs?: string[];",
        "  defaultOutputs?: string[];",
        "  shape?: string;",
        "}",
        "",
        "export const extractedBlocks: Record<string, ExtractedBlock> = ",
    ]

    # Add blocks JSON
    blocks_json = json.dumps(blocks, indent=2, ensure_ascii=False)
    # Fix JSON to be valid TypeScript (unquote keys that are valid identifiers)
    lines.append(blocks_json + ";")
    lines.append("")

    # Add block config
    lines.append("export const blockConfig: Record<Exclude<NodeCategory, 'Subsystem'>, string[]> = {")
    for category, block_names in config.items():
        names_str = ", ".join(f'"{name}"' for name in block_names)
        lines.append(f'  {category}: [{names_str}],')
    lines.append("};")
    lines.append("")

    # Add UI overrides
    lines.append("export const uiOverrides: Record<string, UIOverride> = ")
    overrides_json = json.dumps(overrides, indent=2)
    lines.append(overrides_json + ";")
    lines.append("")

    return "\n".join(lines)


def main():
    print("Extracting PathSim blocks...")

    # Extract all blocks
    extracted_blocks = {}
    for category, block_names in BLOCK_CONFIG.items():
        for block_name in block_names:
            print(f"  Extracting {block_name}...")
            block_data = extract_block(block_name)
            if block_data:
                extracted_blocks[block_name] = block_data

    # Extract extra blocks for docstrings only (not auto-registered)
    for block_name in EXTRA_DOCSTRINGS:
        print(f"  Extracting {block_name} (docstring only)...")
        block_data = extract_block(block_name)
        if block_data:
            extracted_blocks[block_name] = block_data

    print(f"Extracted {len(extracted_blocks)} blocks")

    # Generate TypeScript
    ts_content = generate_typescript(extracted_blocks, BLOCK_CONFIG, UI_OVERRIDES)

    # Write output file
    output_path = Path(__file__).parent.parent / "src" / "lib" / "nodes" / "generated" / "blocks.ts"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(ts_content, encoding="utf-8")

    print(f"Generated {output_path}")


if __name__ == "__main__":
    main()
