import os
import json
import requests as req
from flask import Flask, request, jsonify
from flask_cors import CORS

import io
from contextlib import redirect_stdout, redirect_stderr

'''
The Flask web server would not be initialized simultaneously with the SvelteKit website since the latter is statically generated,
rather there would be some type of deployment of this application such that it could receive requests from 
"https://view.pathsim.org" (which I think is already encapsualted by the "*" in the CORS.resources.options parameter)
'''

def initialize():
    # No need for th emicropip installation as the Pyodide backend does it
    import numpy as np
    import gc
    import pathsim, pathsim_chem
    print(f"PathSim {pathsim.__version__} loaded successfully")
    
    _clean_globals = set(globals().keys())

initialize()

app = Flask(__name__, static_folder="../static", static_url_path="")

if os.getenv("FLASK_ENV") == "production":
    CORS(app,
         resources={
             r"/*": {
                 "origins": ["*"],
                 "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
                 "allow_headers": ["Content-Type", "Authorization"]
             } 
         })
else:
    CORS(
        app, 
        reosurces={
            r"/*": {""
                "origins": {"origins": ["http://localhost:5173", "http://localhost:3000"]}
            }
        },
        supports_credentials=True
    )

# Execute Python route copied from the previous repository
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
    
# @app.route("/runGraphStreamingSimulation", methods=["POST"])
# def runGraphStreamingSimulation():
#     try:
#         # Not fully implemented yet
#         data = request.get_json()
#         nodes, connections, settings_store, code_context, events = data["nodes"], data["connections"], data["settingsStore"], data["codeContext"], data["events"]

#         pass
#     except KeyError as e:
#         return jsonify({"success": False, "error": f"Missing key, error: {e}"})
#     except Exception as e:
#         return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500

# @app.route("/validateGraphSimulation", methods=["POST"])
# def validateGraphSimulation():
#     print("Received a request at /validateGraphSimulation")

#     try:
#         # Not fully implemented yet
#         # - We are going to have to recreate nodeRegistry functionality when given the 
#         # - The original validation program has extractParams() and validateGraphBridge() run
#         # - extractParams() uses primarily nodeRegistry functionality
#         # - validateGraphBridge() uses a bunch of generated Python code to run in Pyodide s.t. we can just run it here

#         data = request.get_json()
#         nodes, code_context, node_registry_nodes = data.get("nodes"), data.get("codeContext"), data.get("nodeRegistryNodes")
#         print("Node registry is: ", node_registry_nodes)

#         # Extract Node Params


#         # Validate Graph Bridge


#         return jsonify({"success": True, "data": {
#             "valid": False,
#             "errors": []
#         }})
#         pass
#     except KeyError as e:
#         return jsonify({"success": False, "error": f"Missing key, error: {e}"})
#     except Exception as e:
#         return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500


# # ------------------- STATE DEPENDENT / CHANGING ROUTES ------------------

# @app.route("/continueStreamingSimulation", methods=["POST"])
# def continueStreamingSimulation():
#     try:
#         # Not fully implemented yet

#         data = request.get_json()
#         duration = data["duration"]
#     except Exception as e:
#         return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500

# @app.route("/initialize", methods=["GET"])
# def initialize():
#     try:
#         # Not fully implemented yet
#         pass
#     except Exception as e:
#         return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500
    
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