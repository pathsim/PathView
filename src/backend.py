import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS

import plotly.graph_objects as go
from plotly.subplots import make_subplots
import plotly
import json as plotly_json
import inspect
import io
from contextlib import redirect_stdout, redirect_stderr

from pathview.convert_to_python import convert_graph_to_python
from pathview.pathsim_utils import make_pathsim_model, map_str_to_object
from pathsim.blocks import Scope, Spectrum

# Sphinx imports for docstring processing
from docutils.core import publish_parts

# imports for logging progress
from flask import Response, stream_with_context
import logging
from queue import Queue, Empty


def docstring_to_html(docstring):
    """Convert a Python docstring to HTML using docutils (like Sphinx does)."""
    if not docstring:
        return "<p>No documentation available.</p>"

    try:
        # Use docutils to convert reStructuredText to HTML
        # This is similar to what Sphinx does internally
        overrides = {
            "input_encoding": "utf-8",
            "doctitle_xform": False,
            "initial_header_level": 2,
        }

        parts = publish_parts(
            source=docstring, writer_name="html", settings_overrides=overrides
        )

        # Return just the body content (without full HTML document structure)
        html_content = parts["body"]

        # Clean up the HTML a bit for better display in the sidebar
        html_content = html_content.replace('<div class="document">', "<div>")

        return html_content

    except Exception as e:
        # Fallback in case of any parsing errors
        import html

        escaped = html.escape(docstring)
        return f"<pre>Error parsing docstring: {str(e)}\n\n{escaped}</pre>"


# Configure Flask app for Cloud Run
app = Flask(__name__, static_folder="../dist", static_url_path="")

# Configure CORS based on environment
if os.getenv("FLASK_ENV") == "production":
    # Production: Allow Cloud Run domains and common domains
    CORS(
        app,
        resources={
            r"/*": {
                "origins": ["*"],  # Allow all origins for Cloud Run
                "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                "allow_headers": ["Content-Type", "Authorization"],
            }
        },
    )
else:
    # Development: Only allow localhost
    CORS(
        app,
        resources={
            r"/*": {"origins": ["http://localhost:5173", "http://localhost:3000"]}
        },
        supports_credentials=True,
    )


### for capturing logs from pathsim


@app.get("/logs/stream")
def logs_stream():
    def gen():
        yield "retry: 500\n\n"
        while True:
            try:
                # Use a timeout to prevent indefinite blocking
                line = log_queue.get(timeout=30)
                for chunk in line.replace("\r", "\n").splitlines():
                    yield f"data: {chunk}\n\n"
            except Empty:
                # Send a heartbeat to keep connection alive
                yield "data: \n\n"
            except Exception as e:
                # Log the error and break the loop to close the connection
                yield f"data: Error in log stream: {str(e)}\n\n"
                break

    return Response(gen(), mimetype="text/event-stream")


log_queue = Queue()


class QueueHandler(logging.Handler):
    def emit(self, record):
        try:
            msg = self.format(record)
            log_queue.put_nowait(msg)
        except Exception:
            pass


qhandler = QueueHandler()
qhandler.setLevel(logging.INFO)
qhandler.setFormatter(logging.Formatter("%(asctime)s - %(levelname)s - %(message)s"))

root = logging.getLogger()
root.setLevel(logging.INFO)
root.addHandler(qhandler)

### log backend ends


# Serve React frontend for production
@app.route("/")
def serve_frontend():
    """Serve the React frontend in production."""
    if os.getenv("FLASK_ENV") == "production":
        return app.send_static_file("index.html")
    else:
        return jsonify({"message": "PathView API", "status": "running"})


# Health check endpoint for Cloud Run
@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({"status": "healthy", "message": "PathView Backend is running"}), 200


# Version information endpoint
@app.route("/version", methods=["GET"])
def get_version():
    try:
        # Get pathsim version
        import pathsim

        pathsim_version = getattr(pathsim, "__version__", "Unknown")

        import pathview

        pathview_version = getattr(pathview, "__version__", "Unknown")

        return jsonify(
            {
                "pathsim_version": pathsim_version,
                "pathview_version": pathview_version,
                "status": "success",
            }
        ), 200
    except Exception as e:
        return jsonify(
            {
                "pathsim_version": "Unknown",
                "pathview_version": "Unknown",
                "status": "error",
                "error": str(e),
            }
        ), 200


@app.route("/default-values-all", methods=["GET"])
def get_all_default_values():
    try:
        all_default_values = {}
        for node_type, block_class in map_str_to_object.items():
            parameters_for_class = inspect.signature(block_class.__init__).parameters
            default_values = {}
            for param in parameters_for_class:
                if param != "self":  # Skip 'self' parameter
                    default_value = parameters_for_class[param].default
                    if default_value is inspect._empty:
                        default_values[param] = None  # Handle empty defaults
                    else:
                        default_values[param] = default_value
                        # check if default value is serializable to JSON
                        if not isinstance(
                            default_value, (int, float, str, bool, list, dict)
                        ):
                            # Attempt to convert to JSON serializable type
                            try:
                                default_values[param] = json.dumps(default_value)
                            except TypeError:
                                # If conversion fails, set to a string 'default'
                                default_values[param] = "default"
            all_default_values[node_type] = default_values

        return jsonify(all_default_values)
    except Exception as e:
        return jsonify({"error": f"Could not get all default values: {str(e)}"}), 400


# returns default values for parameters of a node
@app.route("/default-values/<string:node_type>", methods=["GET"])
def get_default_values(node_type):
    try:
        if node_type not in map_str_to_object:
            return jsonify({"error": f"Unknown node type: {node_type}"}), 400

        block_class = map_str_to_object[node_type]
        parameters_for_class = inspect.signature(block_class.__init__).parameters
        default_values = {}
        for param in parameters_for_class:
            if param != "self":  # Skip 'self' parameter
                default_value = parameters_for_class[param].default
                if default_value is inspect._empty:
                    default_values[param] = None  # Handle empty defaults
                else:
                    default_values[param] = default_value
                    # check if default value is serializable to JSON
                    if not isinstance(
                        default_value, (int, float, str, bool, list, dict)
                    ):
                        # Attempt to convert to JSON serializable type
                        try:
                            default_values[param] = json.dumps(default_value)
                        except TypeError:
                            # If conversion fails, set to a string 'default'
                            default_values[param] = "default"
        return jsonify(default_values)
    except Exception as e:
        return jsonify(
            {"error": f"Could not get default values for {node_type}: {str(e)}"}
        ), 400


@app.route("/get-all-docs", methods=["GET"])
def get_all_docs():
    try:
        all_docs = {}
        for node_type, block_class in map_str_to_object.items():
            docstring = inspect.getdoc(block_class)

            # If no docstring, provide a basic description
            if not docstring:
                docstring = f"No documentation available for {node_type}."

            # Convert docstring to HTML using docutils/Sphinx-style processing
            html_content = docstring_to_html(docstring)

            all_docs[node_type] = {
                "docstring": docstring,  # Keep original for backwards compatibility
                "html": html_content,  # New HTML version
            }

        return jsonify(all_docs)
    except Exception as e:
        return jsonify({"error": f"Could not get docs for all nodes: {str(e)}"}), 400


@app.route("/get-docs/<string:node_type>", methods=["GET"])
def get_docs(node_type):
    try:
        if node_type not in map_str_to_object:
            return jsonify({"error": f"Unknown node type: {node_type}"}), 400

        block_class = map_str_to_object[node_type]
        docstring = inspect.getdoc(block_class)

        # If no docstring, provide a basic description
        if not docstring:
            docstring = f"No documentation available for {node_type}."

        # Convert docstring to HTML using docutils/Sphinx-style processing
        html_content = docstring_to_html(docstring)

        return jsonify(
            {
                "docstring": docstring,  # Keep original for backwards compatibility
                "html": html_content,  # New HTML version
            }
        )
    except Exception as e:
        return jsonify({"error": f"Could not get docs for {node_type}: {str(e)}"}), 400


# Function to convert graph to Python script
@app.route("/convert-to-python", methods=["POST"])
def convert_to_python():
    try:
        data = request.json
        graph_data = data.get("graph")

        if not graph_data:
            return jsonify({"error": "No graph data provided"}), 400

        # Generate the Python script directly using the imported function
        script_content = convert_graph_to_python(graph_data)

        return jsonify(
            {
                "success": True,
                "script": script_content,
                "message": "Python script generated successfully",
            }
        )

    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


# Helper function to extract CSV payload from scopes
def make_csv_payload(scopes):
    csv_payload = {"time": [], "series": {}}

    max_len = 0
    for scope in scopes:
        time, values = scope.read()
        max_len = max(max_len, len(time))
        csv_payload["time"] = time.tolist()
        for i, series in enumerate(values):
            label = scope.labels[i] if i < len(scope.labels) else f"{scope.label} {i}"
            csv_payload["series"][label] = series.tolist()

    return csv_payload


def make_plot(simulation):
    scopes = [block for block in simulation.blocks if isinstance(block, Scope)]
    spectra = [block for block in simulation.blocks if isinstance(block, Spectrum)]
    print(f"Found {len(scopes)} scopes and {len(spectra)} spectra")

    # FIXME right now only the scopes are converted to CSV
    # extra work is needed since spectra and scopes don't share the same x axis
    csv_payload = make_csv_payload(scopes)

    # Share x only if there are only scopes or only spectra
    shared_x = len(scopes) * len(spectra) == 0
    n_rows = len(scopes) + len(spectra)

    if n_rows == 0:
        # No scopes or spectra to plot
        return jsonify(
            {
                "success": True,
                "plot": "{}",
                "html": "<p>No scopes or spectra to display</p>",
                "csv_data": csv_payload,
                "message": "Pathsim simulation completed successfully",
            }
        )

    absolute_vertical_spacing = 0.05
    relative_vertical_spacing = absolute_vertical_spacing / n_rows
    fig = make_subplots(
        rows=n_rows,
        cols=1,
        shared_xaxes=shared_x,
        subplot_titles=[scope.label for scope in scopes]
        + [spec.label for spec in spectra],
        vertical_spacing=relative_vertical_spacing,
    )

    # make scope plots
    for i, scope in enumerate(scopes):
        sim_time, data = scope.read()

        for p, d in enumerate(data):
            lb = scope.labels[p] if p < len(scope.labels) else f"port {p}"
            if isinstance(scope, Spectrum):
                d = abs(d)
            fig.add_trace(
                go.Scatter(x=sim_time, y=d, mode="lines", name=lb),
                row=i + 1,
                col=1,
            )

        fig.update_xaxes(title_text="Time", row=len(scopes), col=1)

    # make spectrum plots
    for i, spec in enumerate(spectra):
        freq, data = spec.read()

        for p, d in enumerate(data):
            lb = spec.labels[p] if p < len(spec.labels) else f"port {p}"
            d = abs(d)
            fig.add_trace(
                go.Scatter(x=freq, y=d, mode="lines", name=lb),
                row=len(scopes) + i + 1,
                col=1,
            )
        fig.update_xaxes(title_text="Frequency", row=len(scopes) + i + 1, col=1)

    fig.update_layout(height=500 * (len(scopes) + len(spectra)), hovermode="x unified")

    return fig, csv_payload


# Function to convert graph to pathsim and run simulation
@app.route("/run-pathsim", methods=["POST"])
def run_pathsim():
    try:
        data = request.json
        graph_data = data.get("graph")
        if not graph_data:
            return jsonify({"error": "No graph data provided"}), 400

        my_simulation, duration = make_pathsim_model(graph_data)

        # get the pathsim logger and add the queue handler
        logger = my_simulation.logger
        logger.addHandler(qhandler)

        # Run the simulation
        my_simulation.run(duration)

        # Generate the plot
        try:
            fig, csv_payload = make_plot(my_simulation)
            print("Created plot figure")

            # Convert plot to JSON
            try:
                plot_data = plotly_json.dumps(fig, cls=plotly.utils.PlotlyJSONEncoder)
                plot_html = fig.to_html()
                print("Converted plot to JSON and HTML")
            except Exception as plot_error:
                print(f"Error converting plot to JSON: {str(plot_error)}")
                return jsonify(
                    {
                        "success": False,
                        "error": f"Plot generation error: {str(plot_error)}",
                    }
                ), 500

            return jsonify(
                {
                    "success": True,
                    "plot": plot_data,
                    "html": plot_html,
                    "csv_data": csv_payload,
                    "message": "Pathsim simulation completed successfully",
                }
            )

        except Exception as plot_creation_error:
            print(f"Error during plot creation: {str(plot_creation_error)}")
            return jsonify(
                {
                    "success": False,
                    "error": f"Plot creation error: {str(plot_creation_error)}",
                }
            ), 500

    except Exception as e:
        # Log the full error for debugging
        import traceback

        error_details = traceback.format_exc()
        print(f"Error in run_pathsim: {error_details}")
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@app.route("/execute-python", methods=["POST"])
def execute_python():
    """Execute Python code and returns variables/functions."""

    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Create a temporary namespace that includes current eval_namespace
        temp_namespace = {}
        # temp_namespace.update(globals())

        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, temp_namespace)

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                return jsonify({"success": False, "error": error_output}), 400

            # Find new variables and functions
            vars = set(temp_namespace.keys())
            # new_vars = vars_after - vars_before

            # Filter out built-ins and modules, keep user-defined items
            user_variables = {}
            user_functions = []

            for var_name in vars:
                if not var_name.startswith("__"):
                    value = temp_namespace[var_name]
                    if callable(value) and hasattr(value, "__name__"):
                        user_functions.append(var_name)
                    else:
                        # Try to serialize the value for display
                        try:
                            if isinstance(value, (int, float, str, bool, list, dict)):
                                user_variables[var_name] = value
                            else:
                                user_variables[var_name] = str(value)
                        except Exception:
                            user_variables[var_name] = (
                                f"<{type(value).__name__} object>"
                            )

            return jsonify(
                {
                    "success": True,
                    "output": output if output else None,
                    "variables": user_variables,
                    "functions": user_functions,
                    "message": f"Executed successfully. Added {len(user_variables)} variables and {len(user_functions)} functions to namespace.",
                }
            )

        except SyntaxError as e:
            return jsonify({"success": False, "error": f"Syntax Error: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"success": False, "error": f"Runtime Error: {str(e)}"}), 400

    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


# Catch-all route for React Router (SPA routing)
@app.route("/<path:path>")
def catch_all(path):
    """Serve React app for all routes in production (for client-side routing)."""
    if os.getenv("FLASK_ENV") == "production":
        return app.send_static_file("index.html")
    else:
        return jsonify({"error": "Route not found"}), 404


# Global error handler to ensure all errors return JSON
@app.errorhandler(Exception)
def handle_exception(e):
    """Global exception handler to ensure JSON responses."""
    import traceback
    from werkzeug.exceptions import HTTPException

    error_details = traceback.format_exc()
    print(f"Unhandled exception: {error_details}")

    # For HTTP exceptions, return a cleaner response
    if isinstance(e, HTTPException):
        return jsonify(
            {"success": False, "error": f"{e.name}: {e.description}"}
        ), e.code

    # For all other exceptions, return a generic JSON error
    return jsonify({"success": False, "error": f"Internal server error: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", 8000))
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") != "production")
