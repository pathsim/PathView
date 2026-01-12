{# Macro-based approach for block creation #}
{% macro create_block(node) -%}
{{ node["var_name"] }} = {{ node["module_name"] }}.{{ node["class_name"] }}(
    {%- for arg in node["expected_arguments"] %}
    {%- if node["data"].get(arg) -%}
    {{ arg }}={{ node["data"].get(arg) }}{% if not loop.last %}, {% endif %}
    {%- endif -%}
    {%- endfor %}
)
{%- endmacro -%}


{% macro create_integrator_block(node) -%}
{{ create_block(node) }}

{%- if node["data"].get("reset_times") %}
events_{{ node["var_name"] }} = {{ node["var_name"] }}.create_reset_events()
events += events_{{ node["var_name"] }}
{%- endif %}

{%- endmacro -%}


{% macro create_bubbler_block(node) -%}
{{ create_block(node) }}

{%- if node["data"].get("replacement_times") %}
{{ node["var_name"] }}._create_reset_events()
events += {{ node["var_name"] }}.events
{%- endif %}

{%- endmacro -%}


{% macro create_connections(edges) -%}
connections = [
    {% for edge in edges -%}
    Connection({{ edge["source_var_name"] }}{{edge["source_port"]}}, {{ edge["target_var_name"] }}{{ edge["target_port"] }}),
    {% endfor -%}
]
{%- endmacro -%}

{% macro create_event(event) -%}
{% if "func_evt" in event %}
{% if event["func_evt_desc"].startswith("def") %}
{{ event["func_evt_desc"] }}
{% endif %}
{% endif %}

{% if "func_act" in event %}
{% if event["func_act_desc"].startswith("def") %}
{{ event["func_act_desc"] }}
{% endif %}
{% endif %}

{{ event["name"] }} = {{ event["module_name"] }}.{{ event["class_name"] }}(
    {%- for arg in event["expected_arguments"] %}
    {%- if event.get(arg) -%}
    {{ arg }}={{ event.get(arg) }}{% if not loop.last %}, {% endif %}
    {%- endif -%}
    {%- endfor %}
)
{%- endmacro -%}