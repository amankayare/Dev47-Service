import os
import requests
from flask import Blueprint, request, jsonify
from utils.jwt_auth import jwt_required

polyglot_bp = Blueprint('polyglot', __name__)

POLYGLOT_URL = os.getenv('POLYGLOT_URL')
POLYGLOT_API_KEY = os.getenv('POLYGLOT_API_KEY')

@polyglot_bp.route('/stage', methods=['POST'])
@jwt_required
def stage_asset():
    """Proxy staging request to Polyglot Storage"""
    if not POLYGLOT_URL or not POLYGLOT_API_KEY:
        return jsonify({"error": "Polyglot Storage is not configured"}), 500

    try:
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        # Forward to Polyglot
        files = {'file': (file.filename, file.stream, file.content_type)}
        headers = {'x-api-key': POLYGLOT_API_KEY}
        
        # Use a longer timeout for file uploads
        response = requests.post(f"{POLYGLOT_URL}/api/v1/assets/stage", files=files, headers=headers, timeout=60)
        data = response.json()

        # Rewrite previewUrl to use this proxy
        if data.get('success') and 'data' in data and 'previewUrl' in data['data']:
            stage_id = data['data']['stageId']
            # Rewrite relative Polyglot URL to local proxy URL
            data['data']['previewUrl'] = f"/api/polyglot/stage/{stage_id}/preview"

        return jsonify(data), response.status_code

    except Exception as e:
        return jsonify({"error": f"Staging failed: {str(e)}"}), 500

@polyglot_bp.route('/stage/<stage_id>/preview', methods=['GET'])
def preview_staged(stage_id):
    """Proxy preview request to Polyglot Storage"""
    from utils.jwt_auth import decode_jwt_token
    
    token = request.args.get('jwt')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            
    if not token:
        return jsonify({"error": "Authorization token required"}), 401
        
    payload = decode_jwt_token(token)
    if not payload or (isinstance(payload, dict) and 'error' in payload):
        return jsonify(payload if payload else {"error": "invalid_token", "message": "Invalid token"}), 401

    if not POLYGLOT_URL or not POLYGLOT_API_KEY:
        return jsonify({"error": "Polyglot Storage is not configured"}), 500

    try:
        headers = {'x-api-key': POLYGLOT_API_KEY}
        response = requests.get(f"{POLYGLOT_URL}/api/v1/assets/stage/{stage_id}/preview", headers=headers, timeout=10)
        
        return (response.content, response.status_code, response.headers.items())

    except Exception as e:
        return jsonify({"error": f"Preview failed: {str(e)}"}), 500

@polyglot_bp.route('/confirm/<stage_id>', methods=['POST'])
@jwt_required
def confirm_asset(stage_id):
    """Proxy confirm request to Polyglot Storage"""
    if not POLYGLOT_URL or not POLYGLOT_API_KEY:
        return jsonify({"error": "Polyglot Storage is not configured"}), 500

    try:
        provider = request.json.get('provider', 'github')
        headers = {'x-api-key': POLYGLOT_API_KEY, 'Content-Type': 'application/json'}
        
        response = requests.post(
            f"{POLYGLOT_URL}/api/v1/assets/stage/{stage_id}/confirm",
            json={"provider": provider},
            headers=headers,
            timeout=30
        )
        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": f"Confirmation failed: {str(e)}"}), 500

@polyglot_bp.route('/stage/<stage_id>', methods=['DELETE'])
@jwt_required
def delete_staged(stage_id):
    """Proxy delete staged request to Polyglot Storage"""
    if not POLYGLOT_URL or not POLYGLOT_API_KEY:
        return jsonify({"error": "Polyglot Storage is not configured"}), 500

    try:
        headers = {'x-api-key': POLYGLOT_API_KEY}
        response = requests.delete(f"{POLYGLOT_URL}/api/v1/assets/stage/{stage_id}", headers=headers, timeout=10)
        return jsonify(response.json()), response.status_code

    except Exception as e:
        return jsonify({"error": f"Discard failed: {str(e)}"}), 500
