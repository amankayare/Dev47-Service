import jwt
import datetime
from flask import request, jsonify, current_app
from functools import wraps

JWT_SECRET = None
JWT_ALGO = 'HS256'

def create_jwt_token(identity: str, user_id=None, is_admin=False):
    global JWT_SECRET
    if not JWT_SECRET:
        JWT_SECRET = current_app.config.get('JWT_SECRET', 'changeme')
    exp_minutes = current_app.config.get('JWT_EXP_MINUTES', 60)
    payload = {
        'sub': identity,
        'user_id': user_id,
        'is_admin': is_admin,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(minutes=exp_minutes)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGO)


def decode_jwt_token(token: str):
    global JWT_SECRET
    if not JWT_SECRET:
        JWT_SECRET = current_app.config.get('JWT_SECRET', 'changeme')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGO])
        return payload
    except jwt.ExpiredSignatureError:
        return {'error': 'token_expired', 'message': 'Token has expired'}
    except jwt.InvalidTokenError:
        return {'error': 'invalid_token', 'message': 'Invalid token'}


def get_current_user_id():
    """Get current user ID from JWT token"""
    auth_header = request.headers.get('Authorization', None)
    if not auth_header:
        return None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
    else:
        token = auth_header
    payload = decode_jwt_token(token)
    if payload:
        return payload.get('user_id')
    return None

def get_current_user_admin_status():
    """Check if current user is admin from JWT token"""
    auth_header = request.headers.get('Authorization', None)
    if not auth_header:
        return False
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
    else:
        token = auth_header
    payload = decode_jwt_token(token)
    if payload:
        return payload.get('is_admin', False)
    return False

def get_current_user():
    """Get current user data from JWT token"""
    auth_header = request.headers.get('Authorization', None)
    if not auth_header:
        return None
    if auth_header.startswith('Bearer '):
        token = auth_header.split(' ', 1)[1]
    else:
        token = auth_header
    payload = decode_jwt_token(token)
    if payload:
        # Return a simple object with user data
        class User:
            def __init__(self, user_id, is_admin):
                self.id = user_id
                self.is_admin = is_admin
        
        return User(payload.get('user_id'), payload.get('is_admin', False))
    return None

def jwt_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({'error': 'no_token', 'message': 'Authorization token required'}), 401
        # Accept both 'Bearer <token>' and raw '<token>'
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        else:
            token = auth_header
        payload = decode_jwt_token(token)
        if not payload:
            return jsonify({'error': 'invalid_request', 'message': 'Invalid authentication request'}), 401
        # Check if payload contains error (expired or invalid token)
        if isinstance(payload, dict) and 'error' in payload:
            return jsonify(payload), 401
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({'error': 'no_token', 'message': 'Authorization token required'}), 401
        # Accept both 'Bearer <token>' and raw '<token>'
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ', 1)[1]
        else:
            token = auth_header
        payload = decode_jwt_token(token)
        if not payload:
            return jsonify({'error': 'invalid_request', 'message': 'Invalid authentication request'}), 401
        # Check if payload contains error (expired or invalid token)
        if isinstance(payload, dict) and 'error' in payload:
            return jsonify(payload), 401
        if not payload.get('is_admin', False):
            return jsonify({'error': 'admin_required', 'message': 'Admin privileges required'}), 403
        return f(*args, **kwargs)
    return decorated_function
