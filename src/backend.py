import os
import json
import traceback
import requests as req
from flask import Flask, request, jsonify, Response, stream_with_context
from flask_cors import CORS

import io
from contextlib import redirect_stdout, redirect_stderr

# Initialization Code

import numpy as np
import gc
import pathsim, pathsim_chem

print(f"PathSim {pathsim.__version__} loaded successfully")

STREAMING_STEP_EXPR = "_step_streaming_gen()"

_clean_globals = set(globals().keys())
namespace = {}

'''
The Flask web server would not be initialized simultaneously with the SvelteKit website since the latter is statically generated,
rather there would be some type of deployment of this application such that it could receive requests from 
"https://view.pathsim.org" (which I think is already encapsualted by the "*" in the CORS.resources.options parameter)
'''


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
    print("We are not in production...")
    CORS(
        app, 
        resources={
            r"/*": {""
                "origins": ["http://localhost:5173", "http://localhost:3000"]
            }
        },
        supports_credentials=True
    )

# Execute Python route copied from the previous repository
@app.route("/execute-code", methods=["POST"])
def execute_code():
    """Execute Python code and returns nothing."""

    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Create a temporary namespace that includes current eval_namespace
        # temp_namespace = {}
        # temp_namespace.update(globals())

        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, namespace)

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                return jsonify({"success": False, "error": error_output})
            
            return jsonify(
                {
                    "success": True,
                    "output": output
                }
            )

        except SyntaxError as e:
            return jsonify({"success": False, "error": f"Syntax Error: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"success": False, "error": f"Runtime Error: {str(e)}"}), 400

    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500

@app.route("/evaluate-expression", methods=["POST"])
def evaluate_expression():
    "Evaluates Python expression and returns result"
    try:
        data = request.json
        expr = data.get("expr")
        
        if not expr.strip():
            return jsonify({"success": False, "error": "No Python expression provided"}), 400
        

        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            result = ""
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                result = eval(expr, namespace)

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                return jsonify({"success": False, "error": error_output})
            
            return jsonify(
                {
                    "success": True,
                    "result": result,
                    "output": output
                }
            )

        except SyntaxError as e:
            return jsonify({"success": False, "error": f"Syntax Error: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"success": False, "error": f"Runtime Error: {str(e)}"}), 400 
    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


@app.route("/traceback", methods=["GET"])
def check_traceback():
    try:
        traceback_text = traceback.format_exc()
        return jsonify({"success": True, "traceback": traceback_text})
    except Exception as e:
        return jsonify({"success": False, "error": f"Server-side error: {e}"})

@app.route("/streamData", methods=["POST"])
def stream_data():
    def generate(expr):
        # Capture stdout and stderror
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        isDone = False
        count = 0
        
        while not isDone:
            print("(Generator) Count: ", count)
            # print("Generator expression is: ", expr)
            # yield json.dumps({"name": "Ayo", "age": 18})

            result = " "
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                result = eval(expr, namespace)
        
            print("Is the result done? ", result["done"])

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                print("Oh no there was an error ;-;")
                return jsonify({"success": False, "error": error_output})
            
            yield json.dumps(
                {
                    "success": True,
                    "result": result,
                    "output": output
                }
            )

            count += 1

            if result["done"]:
                print("Concluding the while loop!")
                isDone = True
    
    try:
        data = request.json
        expr = data.get("expr")

        try:
            return Response(stream_with_context(generate(expr)))
        
        except SyntaxError as e:
            return jsonify({"success": False, "error": f"Syntax Error: {str(e)}"}), 400
        except Exception as e:
            return jsonify({"success": False, "error": f"Runtime Error: {str(e)}"}), 400   


    except Exception as e:
        return jsonify({"success": False, "error": f"Server error: {str(e)}"}), 500


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