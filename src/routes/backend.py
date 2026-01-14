import os
import json
import requests as req
from flask import Flask, request, jsonify
from flask_cors import CORS

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
    CORS(
        app, 
        reosurces={
            r"/*": {""
                "origins": {"origins": ["http://localhost:5173", "http://localhost:3000"]}
            }
        },
        supports_credentials=True
    )

@app.route("/runGraphStreamingSimulation", options=["POST"])
def runGraphStreamingSimulation():
    try:
        # Not fully implemented yet
        data = request.get_json()
        nodes, connections, settingsStore, codeContext, events = data["nodes"], data["connections"], data["settingsStore"], data["codeContext"], data["events"]

        pass
    except KeyError as e:
        return jsonify({"success": False, "error": f"Missing key, error: {e}"})
    except Exception as e:
        return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500

@app.route("/validateGraphSimulation", options=["POST"])
def runGraphStreamingSimulation():
    try:
        # Not fully implemented yet

        data = request.get_json()
        nodes, codeContext = data["nodes"], data["codeContext"]

        pass
    except KeyError as e:
        return jsonify({"success": False, "error": f"Missing key, error: {e}"})
    except Exception as e:
        return jsonify({"success": False, "error": f"Server-side error: {e}"}), 500

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


if __name__ == "__Main__":
    port = int(os.getenv("PORT", 800)) 
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") != "production")