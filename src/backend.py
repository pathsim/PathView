import os
import json
import traceback
import requests as req
from flask import Flask, request, jsonify, Response, stream_with_context, session
from flask_cors import CORS
from flask_session import Session
from cachelib import FileSystemCache

from dotenv import load_dotenv
import pickle
import types
import uuid

import io
from contextlib import redirect_stdout, redirect_stderr

# Initialization Code

import ast
import numpy as np
import gc
import pathsim, pathsim_chem

print(f"PathSim {pathsim.__version__} loaded successfully")

STREAMING_STEP_EXPR = "_step_streaming_gen()"

_clean_globals = set(globals().keys())

'''
The Flask web server would not be initialized simultaneously with the SvelteKit website since the latter is statically generated,
rather there would be some type of deployment of this application such that it could receive requests from 
"https://view.pathsim.org" (which I think is already encapsualted by the "*" in the CORS.resources.options parameter)
'''

load_dotenv()

server_namespace = {}

app = Flask(__name__, static_folder="../static", static_url_path="")

print("The secret key is: ", os.getenv("SECRET_KEY"))

SECRET_KEY = os.getenv("SECRET_KEY")
SESSION_TYPE = 'cachelib'
SESSION_SERIALIZATION_FORMAT = 'json'
SESSION_CACHELIB = FileSystemCache(threshold=500, cache_dir="/sessions")
app.config.from_object(__name__)

Session(app)

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

@app.route("/initialize", methods=["GET"])
def initalize():
    session_id = "None provided...."

    if "id" in session:
        app.logger.info("Our current session ID is %s", session["id"])
        session_id = session["id"]
    else:
        app.logger.info("Making a session id...")
        session_id = uuid.uuid4()
        session["id"] = session_id
        session.permanent = True
        app.logger.info("Made the id: ", session_id)

    try:

        return jsonify({
            "success": True,
            "id": session_id
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": e
        }), 400

@app.route("/idCheck", methods=["GET"])
def namespaceCheck():
    session_id = "No ID provided"
    if "id" in session:
        session_id = session["id"]

    return jsonify({ "success": True, "id": session_id })

# Execute Python route copied from the previous repository
@app.route("/execute-code", methods=["POST"])
def execute_code():
    """Execute Python code and returns nothing."""

    try:
        data = request.json
        code = data.get("code", "")

        if not code.strip():
            return jsonify({"success": False, "error": "No code provided"}), 400

        # Capture stdout and stderr
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        temp_namespace = {}

        try:
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                exec(code, server_namespace)

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                return jsonify({"success": False, "error": error_output})

            return jsonify(
                {
                    "success": True,
                    "output": output,
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
        
        temp_namespace = {}

        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        try:
            result = ""
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                result = eval(expr, server_namespace)

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

@app.route("/streamData", methods=["POST", "GET"])
def stream_data():
    def generate(expr):

        # Capture stdout and stderror
        stdout_capture = io.StringIO()
        stderr_capture = io.StringIO()

        isDone = False
        
        while not isDone:

            result = " "
            with redirect_stdout(stdout_capture), redirect_stderr(stderr_capture):
                result = eval(expr, server_namespace)

            # Capture any output
            output = stdout_capture.getvalue()
            error_output = stderr_capture.getvalue()

            if error_output:
                return jsonify({"success": False, "error": error_output})
            
            # Directly responding with a Flask Response object (as jsonify(...) does) doesn't work
            # so we need to use the json.dumps(...) function to return a string so that it can pass into
            # stream_with_context(...)

            yield json.dumps(
                {
                    "success": True,
                    "result": result,
                    "output": output
                }
            )

            if result["done"]:
                isDone = True
    
    try:
        method = request.method
        
        expr = STREAMING_STEP_EXPR

        if method == "POST":
            data = request.json
            expr = data.get("expr")

        try:
            return Response(stream_with_context(generate(expr)), content_type='application/json')
        
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