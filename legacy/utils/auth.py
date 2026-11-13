from functools import wraps
from flask import request, jsonify, current_app

ADMIN_TOKEN = None  # fallback if not set in config/env

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        global ADMIN_TOKEN
        if not ADMIN_TOKEN:
            ADMIN_TOKEN = current_app.config.get("ADMIN_TOKEN", "changeme")
        token = request.headers.get("Authorization")
        if not token or token != f"Bearer {ADMIN_TOKEN}":
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated_function
