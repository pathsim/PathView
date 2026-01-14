import os
import json
import requests as req
from flask import Flask, request, jsonify
from flask_cors import CORS

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

if __name__ == "__Main__":
    port = int(os.getenv("PORT", 800)) 
    app.run(host="0.0.0.0", port=port, debug=os.getenv("FLASK_ENV") != "production")