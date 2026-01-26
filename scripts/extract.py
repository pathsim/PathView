#!/usr/bin/env python3
"""
PathSim Metadata Extractor

Unified extraction script that reads from config files and generates TypeScript.
Replaces: extract-blocks.py, extract-events.py, extract-simulation.py

Usage:
    python scripts/extract.py              # Extract all
    python scripts/extract.py --blocks     # Blocks only
    python scripts/extract.py --events     # Events only
    python scripts/extract.py --simulation # Simulation only
    python scripts/extract.py --deps       # Dependencies only
    python scripts/extract.py --registry   # JSON registry only (for pvm2py)
    python scripts/extract.py --validate   # Validate configs only
"""

import argparse
import importlib
import inspect
import json
import re
import sys
from pathlib import Path
from typing import Any


# Optional docutils for RST to HTML conversion
try:
    from docutils.core import publish_parts
    HAS_DOCUTILS = True
except ImportError:
    HAS_DOCUTILS = False
    print("Warning: docutils not installed, docstrings will not be converted to HTML")


# =============================================================================
# Shared Utilities
# =============================================================================

def rst_to_html(rst_text: str) -> str:
    """Convert RST docstring to HTML, preserving LaTeX math for KaTeX rendering."""
    if not rst_text or not HAS_DOCUTILS:
        return ""

    # Clean the docstring - removes common leading whitespace from indented docstrings
    cleaned = inspect.cleandoc(rst_text)

    try:
        parts = publish_parts(
            cleaned,
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

    pattern = rf"{param_name}\s*:\s*[^\n]*\n\s+(.+?)(?=\n\s*\w+\s*:|\n\n|$)"
    match = re.search(pattern, docstring, re.DOTALL)
    if match:
        desc = match.group(1).strip()
        desc = re.sub(r"\s+", " ", desc)
        return desc

    return ""


def infer_param_type(value: Any, param_name: str = "") -> str:
    """Infer parameter type from default value."""
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


def format_default(value: Any) -> str | None:
    """Format default value for TypeScript."""
    if value is None:
        return None
    if callable(value) and not isinstance(value, type):
        return None
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
        return "lambda t: None"
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


# =============================================================================
# Config Loading
# =============================================================================

class ConfigLoader:
    """Load and validate JSON config files."""

    def __init__(self, config_dir: Path):
        self.config_dir = config_dir
        self.schemas_dir = config_dir / "schemas"

    def load_json(self, path: Path) -> dict:
        """Load JSON file with optional schema validation."""
        with open(path, encoding="utf-8") as f:
            data = json.load(f)

        if "$schema" in data:
            schema_name = Path(data["$schema"]).name
            schema_path = self.schemas_dir / schema_name
            if schema_path.exists():
                self._validate(data, schema_path)

        return data

    def _validate(self, data: dict, schema_path: Path) -> None:
        """Validate data against JSON schema."""
        try:
            import jsonschema
            with open(schema_path, encoding="utf-8") as f:
                schema = json.load(f)
            jsonschema.validate(data, schema)
        except ImportError:
            pass  # Silent skip if jsonschema not installed
        except Exception as e:
            raise ValueError(f"Config validation failed for {schema_path.name}: {e}")

    def load_requirements(self, filename: str) -> list[dict]:
        """Parse requirements.txt format file.

        Supports:
        - Comments starting with #
        - Global --pre flag (enables pre-releases for all packages)
        - Per-package "# optional" comment (for Pyodide runtime behavior)
        """
        path = self.config_dir / filename
        if not path.exists():
            return []

        packages = []
        global_pre = False

        with open(path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#"):
                    continue

                # Handle global --pre flag
                if line == "--pre":
                    global_pre = True
                    continue

                pkg = {"pip": "", "required": True, "pre": global_pre}

                # Handle # optional comment (for Pyodide runtime)
                if "# optional" in line.lower():
                    pkg["required"] = False

                # Extract pip spec (before any comment)
                pkg["pip"] = line.split("#")[0].strip()

                # Extract package name for import (handle version specs)
                import_name = pkg["pip"]
                for sep in [">=", "==", "<=", "<", ">", "[", "~="]:
                    import_name = import_name.split(sep)[0]
                pkg["import"] = import_name.replace("-", "_")

                if pkg["pip"]:
                    packages.append(pkg)

        return packages

    def load_pyodide_config(self) -> dict:
        """Load pyodide.json config."""
        path = self.config_dir / "pyodide.json"
        if path.exists():
            with open(path, encoding="utf-8") as f:
                return json.load(f)
        return {"version": "0.26.2", "preload": ["numpy", "scipy", "micropip"]}

    def discover_toolboxes(self) -> list[Path]:
        """Find all toolbox config directories."""
        toolboxes = []
        for path in self.config_dir.iterdir():
            if path.is_dir() and path.name != "schemas" and (path / "blocks.json").exists():
                toolboxes.append(path)
        return sorted(toolboxes)


# =============================================================================
# Block Extraction
# =============================================================================

class BlockExtractor:
    """Extract block metadata using Block.info() classmethod."""

    def __init__(self, config_loader: ConfigLoader):
        self.config = config_loader
        self._module_cache: dict[str, Any] = {}

    def extract_all(self) -> tuple[dict, dict, dict[str, str]]:
        """Extract blocks from all toolboxes.

        Returns:
            (extractedBlocks, blockConfig, blockImportPaths)
        """
        all_blocks = {}
        block_config = {}
        block_import_paths: dict[str, str] = {}

        for toolbox_dir in self.config.discover_toolboxes():
            blocks_json = toolbox_dir / "blocks.json"
            config = self.config.load_json(blocks_json)
            import_path = config["importPath"]

            print(f"  Processing toolbox: {config['toolbox']}")

            # Import the module
            try:
                module = self._import_module(import_path)
            except Exception as e:
                print(f"  Warning: Failed to import {import_path}: {e}")
                continue

            # Extract each category
            for category, block_list in config["categories"].items():
                if category not in block_config:
                    block_config[category] = []

                for block_def in block_list:
                    class_name = block_def if isinstance(block_def, str) else block_def["class"]

                    try:
                        cls = getattr(module, class_name)
                        block_data = self._extract_block(cls, config)
                        all_blocks[class_name] = block_data
                        block_config[category].append(class_name)
                        block_import_paths[class_name] = import_path
                        print(f"    Extracted {class_name}")

                    except Exception as e:
                        print(f"    Warning: Failed to extract {class_name}: {e}")

            # Extract extra docstrings (Subsystem, Interface)
            for class_name in config.get("extraDocstrings", []):
                try:
                    cls = self._get_extra_class(class_name, module)
                    if cls and cls.__doc__:
                        all_blocks[class_name] = {
                            "blockClass": class_name,
                            "description": extract_first_line(cls.__doc__),
                            "docstringHtml": rst_to_html(cls.__doc__),
                            "params": {},
                            "inputs": [],
                            "outputs": []
                        }
                        print(f"    Extracted {class_name} (docstring only)")
                except Exception as e:
                    print(f"    Warning: Failed to extract docstring for {class_name}: {e}")

        return all_blocks, block_config, block_import_paths

    def _extract_block(self, cls, config: dict) -> dict:
        """Extract metadata from a single block class using .info()."""
        # Try to use .info() classmethod first
        if hasattr(cls, 'info'):
            try:
                info = cls.info()
                return self._extract_from_info(cls, info)
            except Exception as e:
                print(f"      Warning: .info() failed for {cls.__name__}, falling back to introspection: {e}")

        # Fallback to direct introspection
        return self._extract_from_introspection(cls)

    def _extract_from_info(self, cls, info: dict) -> dict:
        """Extract metadata using Block.info() return value."""
        inputs = self._process_port_labels(info.get("input_port_labels"))
        outputs = self._process_port_labels(info.get("output_port_labels"))

        # Process parameters
        params = {}
        for name, param_info in info.get("parameters", {}).items():
            default = param_info.get("default")
            params[name] = {
                "type": infer_param_type(default, name),
                "default": format_default(default),
                "description": extract_param_description(info.get("description") or "", name)
            }

        return {
            "blockClass": info.get("type", cls.__name__),
            "description": extract_first_line(info.get("description") or ""),
            "docstringHtml": rst_to_html(info.get("description") or ""),
            "params": params,
            "inputs": inputs,
            "outputs": outputs
        }

    def _extract_from_introspection(self, cls) -> dict:
        """Extract metadata using Python introspection (fallback)."""
        sig = inspect.signature(cls.__init__)
        docstring = cls.__doc__ or ""

        # Extract parameters
        params = {}
        for name, param in sig.parameters.items():
            if name == "self":
                continue
            default = None if param.default is inspect.Parameter.empty else param.default
            params[name] = {
                "type": infer_param_type(default, name),
                "default": format_default(default),
                "description": extract_param_description(docstring, name)
            }

        # Try to instantiate to get ports
        try:
            instance = cls()
            inputs = list(getattr(instance.inputs, "_mapping", {}).keys()) if hasattr(instance, "inputs") else []
            outputs = list(getattr(instance.outputs, "_mapping", {}).keys()) if hasattr(instance, "outputs") else []
        except Exception:
            inputs = []
            outputs = []

        return {
            "blockClass": cls.__name__,
            "description": extract_first_line(docstring),
            "docstringHtml": rst_to_html(docstring),
            "params": params,
            "inputs": inputs,
            "outputs": outputs
        }

    def _process_port_labels(self, labels: dict | None) -> list[str] | None:
        """Convert port_labels dict to list of names.

        Port label semantics from Block.info():
        - None: Variable/unlimited ports -> return None
        - {}: No ports of this type -> return []
        - {"name": index, ...}: Fixed labeled ports -> return sorted list
        """
        if labels is None:
            # Variable/unlimited ports - UI should allow add/remove
            return None

        if not labels:
            # Empty dict - no ports of this type
            return []

        # Sort by index value and return names (fixed ports)
        sorted_items = sorted(labels.items(), key=lambda x: x[1])
        return [name for name, _ in sorted_items]

    def _import_module(self, import_path: str) -> Any:
        """Import and cache a module."""
        if import_path not in self._module_cache:
            self._module_cache[import_path] = importlib.import_module(import_path)
        return self._module_cache[import_path]

    def _get_extra_class(self, class_name: str, module: Any) -> type | None:
        """Get a class for extra docstrings, checking multiple sources."""
        cls = getattr(module, class_name, None)
        if cls is not None:
            return cls

        # Try pathsim.subsystem for Subsystem/Interface
        try:
            from pathsim.subsystem import Subsystem, Interface
            if class_name == "Subsystem":
                return Subsystem
            if class_name == "Interface":
                return Interface
        except ImportError:
            pass

        return None


# =============================================================================
# Event Extraction
# =============================================================================

class EventExtractor:
    """Extract event metadata from PathSim."""

    def __init__(self, config_loader: ConfigLoader):
        self.config = config_loader

    def extract_all(self) -> tuple[list[dict], dict[str, str]]:
        """Extract events from all toolboxes.

        Returns:
            (extractedEvents, eventImportPaths)
        """
        all_events = []
        event_import_paths: dict[str, str] = {}

        for toolbox_dir in self.config.discover_toolboxes():
            events_json = toolbox_dir / "events.json"
            if not events_json.exists():
                continue

            config = self.config.load_json(events_json)
            import_path = config["importPath"]
            print(f"  Processing events from: {config['toolbox']}")

            try:
                module = importlib.import_module(import_path)
            except ImportError as e:
                print(f"  Warning: Failed to import {import_path}: {e}")
                continue

            for event_name in config["events"]:
                try:
                    cls = getattr(module, event_name)
                    event_data = self._extract_event(cls)
                    all_events.append(event_data)
                    event_import_paths[event_name] = import_path
                    print(f"    Extracted {event_name}")
                except Exception as e:
                    print(f"    Warning: Failed to extract event {event_name}: {e}")

        return all_events, event_import_paths

    def _extract_event(self, cls) -> dict:
        """Extract metadata from a single event class."""
        sig = inspect.signature(cls.__init__)
        docstring = cls.__doc__ or ""

        params = []
        for name, param in sig.parameters.items():
            if name == "self":
                continue

            default = None if param.default is inspect.Parameter.empty else param.default
            params.append({
                "name": name,
                "type": self._infer_event_param_type(name, default),
                "default": self._format_event_default(default),
                "description": extract_param_description(docstring, name)
            })

        return {
            "type": f"pathsim.events.{cls.__name__}",
            "name": cls.__name__,
            "eventClass": cls.__name__,
            "description": extract_first_line(docstring),
            "docstringHtml": rst_to_html(docstring),
            "params": params
        }

    def _infer_event_param_type(self, param_name: str, value: Any) -> str:
        """Infer event parameter type (uses EventParamType)."""
        if param_name.startswith('func_'):
            return "callable"
        if callable(value) and not isinstance(value, type):
            return "callable"
        if isinstance(value, (int, float)):
            return "number"
        if isinstance(value, str):
            return "string"
        if isinstance(value, (list, tuple)):
            return "array"
        if param_name.endswith('_evt') and 'time' in param_name.lower():
            return "array"
        if value is None and param_name.startswith('func'):
            return "callable"
        if value is None and param_name == 'times_evt':
            return "array"
        return "number"

    def _format_event_default(self, value: Any) -> str | None:
        """Format default value for event parameters."""
        if value is None:
            return "None"
        if callable(value) and not isinstance(value, type):
            return format_default_py(value) or "lambda t: None"
        if isinstance(value, bool):
            return "True" if value else "False"
        if isinstance(value, (int, float)):
            return repr(value)
        if isinstance(value, str):
            return f'"{value}"'
        if isinstance(value, (list, tuple)):
            return repr(list(value))
        return repr(value)


# =============================================================================
# Simulation Extraction
# =============================================================================

class SimulationExtractor:
    """Extract simulation parameters from PathSim."""

    def __init__(self, config_loader: ConfigLoader):
        self.config = config_loader

    def extract(self) -> dict:
        """Extract simulation parameters and solver config."""
        sim_config_path = self.config.config_dir / "pathsim" / "simulation.json"
        if not sim_config_path.exists():
            print("  Warning: simulation.json not found")
            return {}

        sim_config = self.config.load_json(sim_config_path)

        # Import PathSim Simulation class
        try:
            from pathsim import Simulation
        except ImportError as e:
            print(f"  Warning: Failed to import pathsim.Simulation: {e}")
            return {}

        # Get PathSim constants for defaults
        try:
            from pathsim._constants import (
                SIM_TIMESTEP,
                SIM_TIMESTEP_MIN,
                SIM_TIMESTEP_MAX,
                SIM_TOLERANCE_FPI,
                SOL_TOLERANCE_LTE_ABS,
                SOL_TOLERANCE_LTE_REL,
            )
        except ImportError:
            SIM_TIMESTEP = 0.01
            SIM_TIMESTEP_MIN = 1e-12
            SIM_TIMESTEP_MAX = None
            SIM_TOLERANCE_FPI = 1e-12
            SOL_TOLERANCE_LTE_ABS = 1e-6
            SOL_TOLERANCE_LTE_REL = 1e-3

        sig = inspect.signature(Simulation.__init__)
        skip_params = set(sim_config.get("skipParams", []) + ["self"])
        param_map = sim_config.get("paramNameMap", {})
        docstring = Simulation.__doc__ or ""

        extracted_params = {}
        for name, param in sig.parameters.items():
            if name in skip_params:
                continue

            ui_name = param_map.get(name, name)
            default = None if param.default is inspect.Parameter.empty else param.default

            # Handle Solver default
            if name == "Solver":
                default = "SSPRK22"
                param_type = "string"
            else:
                param_type = infer_param_type(default, name)

            extracted_params[ui_name] = {
                "pathsim_name": name,
                "type": param_type,
                "default": format_default_py(default),
                "description": extract_param_description(docstring, name)
            }

        # Add solver_kwargs parameters
        extracted_params["rtol"] = {
            "pathsim_name": "tolerance_lte_rel",
            "type": "number",
            "default": repr(SOL_TOLERANCE_LTE_REL),
            "description": "Relative error tolerance for adaptive timestep control"
        }
        extracted_params["atol"] = {
            "pathsim_name": "tolerance_lte_abs",
            "type": "number",
            "default": repr(SOL_TOLERANCE_LTE_ABS),
            "description": "Absolute error tolerance for adaptive timestep control"
        }

        # Add duration (for sim.run())
        extracted_params["duration"] = {
            "pathsim_name": "duration",
            "type": "number",
            "default": "10.0",
            "description": "Total simulation time"
        }

        # Override defaults from constants
        if "dt" in extracted_params:
            extracted_params["dt"]["default"] = repr(SIM_TIMESTEP)
        if "dt_min" in extracted_params:
            extracted_params["dt_min"]["default"] = repr(SIM_TIMESTEP_MIN)
        if "dt_max" in extracted_params and SIM_TIMESTEP_MAX is not None:
            extracted_params["dt_max"]["default"] = repr(SIM_TIMESTEP_MAX)
            extracted_params["dt_max"]["type"] = "number"
        if "ftol" in extracted_params:
            extracted_params["ftol"]["default"] = repr(SIM_TOLERANCE_FPI)

        # Flatten solvers list
        solver_config = sim_config["solverConfig"]
        all_solvers = []
        for timing in solver_config.values():
            for solvers in timing.values():
                all_solvers.extend(solvers)

        return {
            "description": extract_first_line(docstring),
            "docstringHtml": rst_to_html(docstring),
            "extractedSimulationParams": extracted_params,
            "uiOnlyParams": {
                name: {"pathsim_name": "", **info}
                for name, info in sim_config.get("uiOnlyParams", {}).items()
            },
            "solverConfig": solver_config,
            "availableSolvers": sorted(set(all_solvers))
        }


# =============================================================================
# Dependency Extraction
# =============================================================================

class DependencyExtractor:
    """Extract and generate dependency configuration."""

    def __init__(self, config_loader: ConfigLoader):
        self.config = config_loader

    def _get_package_version(self, import_name: str) -> str | None:
        """Get installed version of a package (strips local version identifiers)."""
        try:
            module = importlib.import_module(import_name)
            version = getattr(module, '__version__', None)
            if version:
                # Strip local version identifier (e.g., +g22f8f27) - not supported by PyPI
                version = version.split('+')[0]
            return version
        except ImportError:
            return None

    def extract(self) -> dict:
        """Extract all dependency information including installed versions."""
        pyodide_config = self.config.load_pyodide_config()
        pyodide_packages = self.config.load_requirements("requirements-pyodide.txt")

        # Get installed versions and create pinned package specs
        extracted_versions = {}
        for pkg in pyodide_packages:
            version = self._get_package_version(pkg["import"])
            if version:
                extracted_versions[pkg["import"]] = version
                base_name = pkg["pip"].split(">=")[0].split("==")[0].split("<=")[0].split("<")[0].split(">")[0]

                # Only pin release versions (not dev versions which aren't on PyPI)
                if ".dev" in version:
                    print(f"    {base_name} {version} is dev version, keeping original spec: {pkg['pip']}")
                else:
                    pkg["pip"] = f"{base_name}=={version}"
                    print(f"    Pinned {base_name} to version {version}")

        return {
            "pyodide": pyodide_config,
            "packages": pyodide_packages,
            "extracted_versions": extracted_versions
        }


# =============================================================================
# TypeScript Generation
# =============================================================================

class RegistryGenerator:
    """Generate JSON registry for pvm2py converter."""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir

    def write_registry(self, blocks: dict, block_import_paths: dict[str, str],
                       events: list, event_import_paths: dict[str, str]) -> None:
        """Write registry.json with import paths and valid param names."""
        registry: dict[str, Any] = {"blocks": {}, "events": {}}

        for block_name, block_data in blocks.items():
            params = list(block_data.get("params", {}).keys())
            registry["blocks"][block_name] = {
                "blockClass": block_data["blockClass"],
                "importPath": block_import_paths.get(block_name, "pathsim.blocks"),
                "params": params,
            }

        for event_data in events:
            event_name = event_data["name"]
            params = [p["name"] for p in event_data.get("params", [])]
            registry["events"][event_name] = {
                "eventClass": event_data["eventClass"],
                "importPath": event_import_paths.get(event_name, "pathsim.events"),
                "params": params,
            }

        output_path = self.output_dir / "generated" / "registry.json"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(
            json.dumps(registry, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8"
        )
        print(f"Generated: {output_path}")


class TypeScriptGenerator:
    """Generate TypeScript output files."""

    def __init__(self, output_dir: Path):
        self.output_dir = output_dir

    def write_blocks(self, blocks: dict, config: dict, import_paths: dict[str, str] | None = None) -> None:
        """Write blocks.ts file."""
        lines = [
            "// Auto-generated by scripts/extract.py - DO NOT EDIT",
            "// Re-run 'npm run extract' to update",
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
            "  inputs: string[] | null;  // null = variable/unlimited, [] = none, [...] = fixed",
            "  outputs: string[] | null; // null = variable/unlimited, [] = none, [...] = fixed",
            "}",
            "",
            "export const extractedBlocks: Record<string, ExtractedBlock> = ",
        ]

        lines.append(json.dumps(blocks, indent=2, ensure_ascii=False) + ";")
        lines.append("")

        lines.append("export const blockConfig: Record<string, string[]> = {")
        for category, block_names in config.items():
            names_str = ", ".join(f'"{name}"' for name in block_names)
            lines.append(f"  {category}: [{names_str}],")
        lines.append("};")
        lines.append("")

        # Import paths map (block name -> Python import path)
        if import_paths:
            lines.append("export const blockImportPaths: Record<string, string> = {")
            for block_name, path in sorted(import_paths.items()):
                lines.append(f'  "{block_name}": "{path}",')
            lines.append("};")
            lines.append("")

        output_path = self.output_dir / "nodes" / "generated" / "blocks.ts"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Generated: {output_path}")

    def write_events(self, events: list) -> None:
        """Write events.ts file."""
        lines = [
            "// Auto-generated by scripts/extract.py - DO NOT EDIT",
            "// Re-run 'npm run extract' to update",
            "",
            "import type { EventTypeDefinition } from '../types';",
            "",
            "export const extractedEvents: EventTypeDefinition[] = ",
        ]

        lines.append(json.dumps(events, indent=2, ensure_ascii=False) + ";")
        lines.append("")

        output_path = self.output_dir / "events" / "generated" / "events.ts"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Generated: {output_path}")

    def write_simulation(self, data: dict) -> None:
        """Write simulation.ts file."""
        lines = [
            "// Auto-generated by scripts/extract.py - DO NOT EDIT",
            "// Re-run 'npm run extract' to update",
            "",
            "/**",
            " * Extracted from PathSim Simulation class",
            " */",
            "",
            "export interface ExtractedSimulationParam {",
            "  pathsim_name: string;",
            "  type: string;",
            "  default: string | null;",
            "  description: string;",
            "}",
            "",
            f"export const simulationDescription = {json.dumps(data.get('description', ''))};",
            "",
            f"export const simulationDocstringHtml = {json.dumps(data.get('docstringHtml', ''))};",
            "",
            "export const extractedSimulationParams: Record<string, ExtractedSimulationParam> = ",
        ]

        lines.append(json.dumps(data.get("extractedSimulationParams", {}), indent=2) + ";")
        lines.append("")

        lines.append("// UI-only parameters (not from PathSim)")
        lines.append("export const uiOnlyParams: Record<string, ExtractedSimulationParam> = ")
        lines.append(json.dumps(data.get("uiOnlyParams", {}), indent=2) + ";")
        lines.append("")

        lines.append("export const solverConfig = ")
        lines.append(json.dumps(data.get("solverConfig", {}), indent=2) + ";")
        lines.append("")

        lines.append(f"export const availableSolvers = {json.dumps(data.get('availableSolvers', []))};")
        lines.append("")

        output_path = self.output_dir / "simulation" / "generated" / "simulation.ts"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Generated: {output_path}")

    def write_dependencies(self, data: dict) -> None:
        """Write dependencies.ts file."""
        pyodide = data.get("pyodide", {})
        packages = data.get("packages", [])
        extracted_versions = data.get("extracted_versions", {})

        # Read PathView version from package.json (at project root, 2 levels up from src/lib)
        package_json_path = self.output_dir.parent.parent / "package.json"
        pathview_version = "0.0.0"
        if package_json_path.exists():
            try:
                package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
                pathview_version = package_data.get("version", "0.0.0")
            except Exception:
                pass

        lines = [
            "// Auto-generated by scripts/extract.py - DO NOT EDIT",
            "// Source: scripts/config/requirements-pyodide.txt, scripts/config/pyodide.json",
            "",
            f"export const PATHVIEW_VERSION = '{pathview_version}';",
            "",
            f"export const PYODIDE_VERSION = '{pyodide.get('version', '0.26.2')}';",
            "export const PYODIDE_CDN_URL = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/pyodide.mjs`;",
            "",
            f"export const PYODIDE_PRELOAD = {json.dumps(pyodide.get('preload', []))} as const;",
            "",
            "/** Package versions extracted at build time (pinned for runtime) */",
            f"export const EXTRACTED_VERSIONS: Record<string, string> = {json.dumps(extracted_versions)};",
            "",
            "export interface PackageConfig {",
            "  pip: string;",
            "  pre: boolean;",
            "  required: boolean;",
            "  import: string;",
            "}",
            "",
            "export const PYTHON_PACKAGES: PackageConfig[] = ",
        ]

        lines.append(json.dumps(packages, indent=2) + ";")
        lines.append("")

        output_path = self.output_dir / "constants" / "dependencies.ts"
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text("\n".join(lines), encoding="utf-8")
        print(f"Generated: {output_path}")


# =============================================================================
# Main
# =============================================================================

def main():
    parser = argparse.ArgumentParser(
        description="PathSim Metadata Extractor",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/extract.py              # Extract all
  python scripts/extract.py --blocks     # Blocks only
  python scripts/extract.py --events     # Events only
  python scripts/extract.py --simulation # Simulation only
  python scripts/extract.py --deps       # Dependencies only
  python scripts/extract.py --registry   # JSON registry only (for pvm2py)
  python scripts/extract.py --validate   # Validate configs only
"""
    )
    parser.add_argument("--blocks", action="store_true", help="Extract blocks only")
    parser.add_argument("--events", action="store_true", help="Extract events only")
    parser.add_argument("--simulation", action="store_true", help="Extract simulation only")
    parser.add_argument("--deps", action="store_true", help="Extract dependencies only")
    parser.add_argument("--registry", action="store_true", help="Generate JSON registry only")
    parser.add_argument("--validate", action="store_true", help="Validate configs only")
    args = parser.parse_args()

    # If no specific flag, extract all
    extract_all = not (args.blocks or args.events or args.simulation or args.deps or args.registry or args.validate)

    config_dir = Path(__file__).parent / "config"
    output_dir = Path(__file__).parent.parent / "src" / "lib"

    if not config_dir.exists():
        print(f"Error: Config directory not found: {config_dir}")
        sys.exit(1)

    config = ConfigLoader(config_dir)
    scripts_dir = Path(__file__).parent
    generator = TypeScriptGenerator(output_dir)
    registry_gen = RegistryGenerator(scripts_dir)

    if args.validate:
        print("Validating configs...")
        try:
            for toolbox_dir in config.discover_toolboxes():
                config.load_json(toolbox_dir / "blocks.json")
                events_json = toolbox_dir / "events.json"
                if events_json.exists():
                    config.load_json(events_json)
            sim_json = config_dir / "pathsim" / "simulation.json"
            if sim_json.exists():
                config.load_json(sim_json)
            print("All configs valid!")
        except Exception as e:
            print(f"Validation failed: {e}")
            sys.exit(1)
        return

    print("PathSim Metadata Extractor")
    print("=" * 40)

    if extract_all or args.deps:
        print("\nExtracting dependencies...")
        deps = DependencyExtractor(config).extract()
        generator.write_dependencies(deps)

    # Track extracted data for registry generation
    blocks = None
    block_import_paths: dict[str, str] = {}
    events = None
    event_import_paths: dict[str, str] = {}

    if extract_all or args.blocks or args.registry:
        print("\nExtracting blocks...")
        blocks, block_config, block_import_paths = BlockExtractor(config).extract_all()
        if extract_all or args.blocks:
            generator.write_blocks(blocks, block_config, block_import_paths)
        print(f"  Total: {len(blocks)} blocks")

    if extract_all or args.events or args.registry:
        print("\nExtracting events...")
        events, event_import_paths = EventExtractor(config).extract_all()
        if extract_all or args.events:
            generator.write_events(events)
        print(f"  Total: {len(events)} events")

    if extract_all or args.simulation:
        print("\nExtracting simulation parameters...")
        sim = SimulationExtractor(config).extract()
        generator.write_simulation(sim)
        print(f"  Total: {len(sim.get('extractedSimulationParams', {}))} parameters")

    if extract_all or args.registry:
        if blocks is not None and events is not None:
            print("\nGenerating JSON registry...")
            registry_gen.write_registry(blocks, block_import_paths, events, event_import_paths)

    print("\nDone!")


if __name__ == "__main__":
    main()
