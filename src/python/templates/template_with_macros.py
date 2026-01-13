import pathsim
from pathsim import Simulation, Connection
import numpy as np
import matplotlib.pyplot as plt
import pathview
import pathsim_chem
{# Import macros #}
{% from 'block_macros.py' import create_block, create_integrator_block, create_bubbler_block, create_connections, create_event -%}

# Create global variables

{%- if pythonCode %}
{{ pythonCode }}
{% endif -%}

{% for var in globalVariables -%}
{{ var["name"] }} = {{ var["value"] }}
{% endfor %}
# Create blocks
blocks, events = [], []

{% for node in nodes -%}
{%- if node["type"] == "integrator" -%}
{{ create_integrator_block(node) }}
{%- elif node["type"] == "bubbler" -%}
{{ create_bubbler_block(node) }}
{%- else -%}
{{ create_block(node) }}
{%- endif %}
blocks.append({{ node["var_name"] }})

{% endfor %}

# Create events
{% for event in events -%}
{{ create_event(event) }}
events.append({{ event["name"] }})
{% endfor %}

# Create connections

{{ create_connections(edges) }}

# Create simulation
my_simulation = Simulation(
    blocks,
    connections,
    events=events,
    Solver=pathsim.solvers.{{ solverParams["Solver"] }},
    dt={{ solverParams["dt"] }},
    {%- if solverParams["dt_max"] != '' -%}
    dt_max={{ solverParams["dt_max"] }},
    {%- endif -%}
    {%- if solverParams["dt_min"] != '' -%}
    dt_min={{ solverParams["dt_min"] }},
    {%- endif -%}
    iterations_max={{ solverParams["iterations_max"] }},
    log={{ solverParams["log"].capitalize() }},
    tolerance_fpi={{ solverParams["tolerance_fpi"] }},
    {%- if solverParams["extra_params"] != '' -%}
    **{{ solverParams["extra_params"] }},
    {%- endif -%}
)

if __name__ == "__main__":
    my_simulation.run({{ solverParams["simulation_duration"] }})

    # Optional: Plotting results
    scopes = [block for block in blocks if isinstance(block, pathsim.blocks.Scope)]
    fig, axs = plt.subplots(nrows=len(scopes), sharex=True, figsize=(10, 5 * len(scopes)))
    for i, scope in enumerate(scopes):
        plt.sca(axs[i] if len(scopes) > 1 else axs)
        time, data = scope.read()
        # plot the recorded data
        for p, d in enumerate(data):
            lb = scope.labels[p] if p < len(scope.labels) else f"port {p}"
            plt.plot(time, d, label=lb)
        plt.legend()
    plt.xlabel("Time")
    plt.show()
