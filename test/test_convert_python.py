from pathview import convert_graph_to_python
import json
import pytest
from pathlib import Path

# Create sample graph data
sample_data = {
    "nodes": [
        {
            "id": "1",
            "type": "constant",
            "data": {
                "label": "input_signal",
                "value": "1.0",
            },
        },
        {
            "id": "2",
            "type": "integrator",
            "data": {
                "label": "integrator_1",
                "initial_value": "",
                "reset_times": "[10, 20]",
            },
        },
        {"id": "3", "type": "amplifier", "data": {"label": "amp_1", "gain": "2.0"}},
        {
            "id": "4",
            "type": "function",
            "data": {
                "label": "func_block",
                "func": "lambda x: x * 2 + 1",
            },
        },
        {
            "id": "5",
            "type": "scope",
            "data": {
                "label": "scope_1",
                "labels": "",
                "sampling_rate": "",
                "t_wait": "",
            },
        },
    ],
    "events": [],
    "edges": [
        {
            "source": "1",
            "target": "2",
            "id": "e1-2",
            "sourceHandle": None,
            "targetHandle": None,
        },
        {
            "source": "2",
            "target": "3",
            "id": "e2-3",
            "sourceHandle": None,
            "targetHandle": None,
        },
        {
            "source": "3",
            "target": "4",
            "id": "e3-4",
            "sourceHandle": None,
            "targetHandle": "target-0",
        },
        {
            "source": "3",
            "target": "5",
            "id": "e3-5",
            "sourceHandle": None,
            "targetHandle": None,
        },
        {
            "source": "4",
            "target": "5",
            "id": "e4-5",
            "sourceHandle": "source-0",
            "targetHandle": None,
        },
    ],
    "solverParams": {
        "Solver": "SSPRK22",
        "dt": "0.01",
        "dt_max": "1.0",
        "dt_min": "1e-6",
        "extra_params": "{}",
        "iterations_max": "100",
        "log": "true",
        "simulation_duration": "duration",
        "tolerance_fpi": "1e-6",
    },
    "globalVariables": [
        {"id": "1", "name": "duration", "nameError": "false", "value": "50.0"},
        {"id": "2", "name": "a", "nameError": "false", "value": "2"},
    ],
}


@pytest.mark.parametrize(
    "data",
    [
        sample_data,
        "test_files/constant_delay_scope.json",
        "test_files/custom_nodes.json",
        "test_files/same_label.json",
        "test_files/bubbler.json",
        "test_files/spectrum.json",
    ],
)
def test_nested_templates(data):
    """Test the nested template functionality."""

    # Process the data
    if not isinstance(data, dict):
        # read from json file using path relative to current file
        current_file_dir = Path(__file__).parent
        file_path = current_file_dir / data
        with open(file_path, "r") as f:
            data = json.load(f)

    code = convert_graph_to_python(data)
    print(code)
    # execute the generated code and check for errors
    try:
        exec(code)
    except Exception as e:
        print(f"Error occurred: {e}")
        assert False


def test_bubbler_has_reset_times():
    """Test that the bubbler node has reset times in the generated code."""
    sample_data = {
        "nodes": [
            {
                "id": "1",
                "type": "bubbler",
                "data": {
                    "label": "bubbler",
                    "replacement_times": "[10, 20]",
                    "conversion_efficiency": "1",
                    "vial_efficiency": "0.8",
                },
            },
        ],
        "edges": [],
        "events": [],
        "solverParams": {
            "Solver": "SSPRK22",
            "dt": "0.01",
            "dt_max": "1.0",
            "dt_min": "1e-6",
            "extra_params": "{}",
            "iterations_max": "100",
            "log": "true",
            "simulation_duration": "duration",
            "tolerance_fpi": "1e-6",
        },
        "globalVariables": [],
        "pythonCode": "def func(t):\n  print('coucou')\n  return 2\n",
    }
    code = convert_graph_to_python(sample_data)
    print(code)
    assert "bubbler_1._create_reset_events()" in code


if __name__ == "__main__":
    test_nested_templates()
