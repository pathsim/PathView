from jinja2 import Environment, FileSystemLoader
import os
from inspect import signature

from .pathsim_utils import (
    map_str_to_object,
    map_str_to_event,
    make_blocks,
    make_global_variables,
    get_input_index,
    get_output_index,
    find_block_by_id,
    find_node_by_id,
    make_var_name,
)


def convert_graph_to_python(graph_data: dict) -> str:
    """Convert graph data to a Python script as a string."""
    # Get the directory of this file to properly reference templates
    current_dir = os.path.dirname(os.path.abspath(__file__))
    templates_dir = os.path.join(current_dir, "templates")

    environment = Environment(loader=FileSystemLoader(templates_dir))
    template = environment.get_template("template_with_macros.py")

    # Process the graph data
    context = process_graph_data_from_dict(graph_data)

    # Render the template
    return template.render(context)


def process_node_data(nodes: list[dict]) -> list[dict]:
    """
    Given a list of node and edge data as dictionaries, process the nodes to create
    variable names, class names, and expected arguments for each node.

    Returns:
        The processed node data with variable names, class names, and expected arguments.
    """
    nodes = nodes.copy()

    for node in nodes:
        node["var_name"] = make_var_name(node)

        # Add pathsim class name
        block_class = map_str_to_object.get(node["type"])
        node["class_name"] = block_class.__name__
        node["module_name"] = block_class.__module__

        # Add expected arguments
        node["expected_arguments"] = signature(block_class).parameters

    return nodes


# TODO: this is effectively a duplicate of pathsim_utils.make_connections
# need to refactor
def make_edge_data(data: dict) -> list[dict]:
    """
    Process edges to add source/target variable names and ports.

    Does it by creating pathsim.blocks and Connections from the data with
    ``make_blocks`` and ``make_connections`` functions.

    Then, since the data (source/target blocks, ports) is already in the
    connections, we can simply read the ports id from the actual pathsim
    connections and add them to the edges.

    Args:
        data: The graph data containing "nodes" and "edges".

    Returns:
        The processed edges with source/target variable names and ports.
    """
    data = data.copy()

    # we need the namespace since we call make_blocks

    global_vars = data.get("globalVariables", {})

    # Get the global variables namespace to use in eval calls
    global_namespace = make_global_variables(global_vars)

    # Create a combined namespace that includes built-in functions and global variables
    eval_namespace = globals().copy()
    eval_namespace.update(global_namespace)

    # Execute python code first to define any variables that blocks might need
    python_code = data.get("pythonCode", "")
    if python_code:
        exec(python_code, eval_namespace)

    blocks, _ = make_blocks(data["nodes"], eval_namespace=eval_namespace)

    # Process each node and its sorted incoming edges to create connections
    block_to_input_index = {b: 0 for b in blocks}
    for node in data["nodes"]:
        outgoing_edges = [
            edge for edge in data["edges"] if edge["source"] == node["id"]
        ]
        outgoing_edges.sort(key=lambda x: x["target"])

        block = find_block_by_id(node["id"], blocks)

        for edge in outgoing_edges:
            target_block = find_block_by_id(edge["target"], blocks)
            target_node = find_node_by_id(edge["target"], data["nodes"])

            output_index = get_output_index(block, edge)
            input_index = get_input_index(target_block, edge, block_to_input_index)

            # if it's a scope, find labels
            if target_node["type"] == "scope":
                if target_node["data"]["labels"] == "":
                    target_node["data"]["labels"] = []

                if isinstance(target_node["data"]["labels"], list):
                    label = node["data"]["label"]
                    if edge["sourceHandle"]:
                        label += f" ({edge['sourceHandle']})"
                    target_node["data"]["labels"].append(label)

            edge["source_var_name"] = node["var_name"]
            edge["target_var_name"] = target_node["var_name"]
            if isinstance(output_index, str):
                edge["source_port"] = f"['{output_index}']"
            else:
                edge["source_port"] = f"[{output_index}]"
            if isinstance(input_index, str):
                edge["target_port"] = f"['{input_index}']"
            else:
                edge["target_port"] = f"[{input_index}]"
            block_to_input_index[target_block] += 1

    return data["edges"]


def make_events_data(data: dict) -> list[dict]:
    """
    Process events data from the graph data.

    This function extracts event definitions from the graph data and prepares them
    for use in the simulation.

    Args:
        data: The graph data containing "events".

    Returns:
        A list of processed events.
    """
    for event in data["events"]:
        # Add pathsim class name
        event_class = map_str_to_event.get(event["type"])
        event["class_name"] = event_class.__name__
        event["module_name"] = event_class.__module__

        # Add expected arguments
        event["expected_arguments"] = signature(event_class).parameters

        if "func_evt" in event:
            # if the whole function in defined in the event, make sure it has a unique identifier
            if event["func_evt"].startswith("def"):
                # replace the name of the function by something unique
                func_evt = event["func_evt"]
                func_evt = func_evt.replace(
                    "def func_evt", f"def {event['name']}_func_evt"
                )
                event["func_evt"] = f"{event['name']}_func_evt"
                event["func_evt_desc"] = func_evt
            # otherwise assume it was defined in the global namespace
            # and just copy the function identifier
            else:
                event["func_evt_desc"] = event["func_evt"]

        if "func_act" in event:
            # if the whole function in defined in the event, make sure it has a unique identifier
            if event["func_act"].startswith("def"):
                # replace the name of the function by something unique
                func_act = event["func_act"]
                func_act = func_act.replace(
                    "def func_act", f"def {event['name']}_func_act"
                )
                event["func_act"] = f"{event['name']}_func_act"
                event["func_act_desc"] = func_act
            # otherwise assume it was defined in the global namespace
            # and just copy the function identifier
            else:
                event["func_act_desc"] = event["func_act"]
    return data["events"]


def process_graph_data_from_dict(data: dict) -> dict:
    """
    Process graph data from a dictionary.

    Adds variable names, class names, and expected arguments to nodes,
    and processes edges to include source/target variable names and ports.

    This processed data can then be more easily used to generate Python code.
    """
    data = data.copy()

    # Process nodes to create variable names and class names
    data["nodes"] = process_node_data(data["nodes"])

    # Process to add source/target variable names to edges + ports
    data["edges"] = make_edge_data(data)

    data["events"] = make_events_data(data)

    return data
