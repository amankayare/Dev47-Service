from flask import Blueprint, request, jsonify, current_app
from utils.jwt_auth import create_jwt_token
from models import User, db
from datetime import datetime
from schemas import UserRegistrationSchema, UserLoginSchema
from marshmallow import ValidationError

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/token', methods=['POST'])
def get_token():
    """Get JWT token for admin (requires HTTP Basic Auth)
    ---
    tags:
      - Auth
    security:
      - BasicAuth: []
    responses:
      200:
        description: JWT token issued
        content:
          application/json:
            schema:
              type: object
              properties:
                access_token:
                  type: string
      401:
        description: Invalid credentials
    """
    from flask import request
    auth = request.authorization
    if not auth or not auth.username or not auth.password:
        return jsonify({'error': 'Missing or invalid Basic Auth credentials'}), 401
    # Look up user in database and check password and is_admin
    user = User.query.filter_by(username=auth.username).first()
    if user and user.check_password(auth.password):
        token = create_jwt_token(identity=user.username, user_id=user.id, is_admin=user.is_admin)
        return jsonify({'access_token': token}), 200
    return jsonify({'error': 'Invalid credentials'}), 401

@auth_bp.route('/register', methods=['POST'])
def register():
    """User registration
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - email
            - password
          properties:
            username:
              type: string
              description: Username
            email:
              type: string
              description: Email address
            password:
              type: string
              description: Password
    responses:
      201:
        description: User registered successfully
      400:
        description: Validation error or user already exists
    """
    try:
        schema = UserRegistrationSchema()
        data = schema.load(request.json)
        
        # Check if user already exists
        if User.query.filter_by(username=data['username']).first():
            return jsonify({'error': 'Username already exists'}), 400
        if User.query.filter_by(email=data['email']).first():
            return jsonify({'error': 'Email already exists'}), 400
        
        # Create new user
        user = User(
            username=data['username'],
            email=data['email']
        )
        user.set_password(data['password'])
        
        db.session.add(user)
        db.session.commit()
        
        return jsonify({
            'message': 'User registered successfully',
            'user': user.to_dict()
        }), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.messages}), 400
    except Exception as e:
        return jsonify({'error': 'Registration failed'}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    """User login
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - username
            - password
          properties:
            username:
              type: string
              description: Username or email
            password:
              type: string
              description: Password
    responses:
      200:
        description: Login successful
      401:
        description: Invalid credentials
    """
    try:
        schema = UserLoginSchema()
        data = schema.load(request.json)
        
        # Find user by username or email
        user = User.query.filter(
            (User.username == data['username']) | 
            (User.email == data['username'])
        ).first()
        
        if user and user.check_password(data['password']):
            # Update last login
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            token = create_jwt_token(identity=user.username, user_id=user.id, is_admin=user.is_admin)
            return jsonify({
                'access_token': token,
                'user': user.to_dict(),
                'message': 'Login successful'
            }), 200
        
        return jsonify({'error': 'Invalid credentials'}), 401
        
    except ValidationError as e:
        return jsonify({'error': 'Validation error', 'details': e.messages}), 400
    except Exception as e:
        return jsonify({'error': 'Login failed'}), 500

@auth_bp.route('/me', methods=['GET'])
def get_current_user():
    """Get current user info
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: Current user info
      401:
        description: Authentication required
    """
    from utils.jwt_auth import jwt_required, get_current_user_id
    
    @jwt_required
    def _get_user():
        user_id = get_current_user_id()
        user = User.query.get(user_id)
        if user:
            return jsonify({'user': user.to_dict()}), 200
        return jsonify({'error': 'User not found'}), 404
    
    return _get_user()


@auth_bp.route('/change-password', methods=['PUT'])
def change_password():
    """Change current user's password
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - currentPassword
            - newPassword
          properties:
            currentPassword:
              type: string
              description: Current password for verification
            newPassword:
              type: string
              description: New password
    responses:
      200:
        description: Password changed successfully
      400:
        description: Validation error
      401:
        description: Authentication required or invalid current password
      404:
        description: User not found
    """
    from utils.jwt_auth import jwt_required, get_current_user_id
    
    @jwt_required
    def _change_password():
        try:
            data = request.json
            if not data:
                return jsonify({'error': 'Request body required'}), 400
            
            current_password = data.get('currentPassword')
            new_password = data.get('newPassword')
            
            # Validation
            if not current_password or not new_password:
                return jsonify({'error': 'Both currentPassword and newPassword are required'}), 400
            
            if len(new_password) < 8:
                return jsonify({'error': 'New password must be at least 8 characters long'}), 400
            
            # Get current user
            user_id = get_current_user_id()
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            # Verify current password
            if not user.check_password(current_password):
                return jsonify({'error': 'Current password is incorrect'}), 401
            
            # Don't allow same password
            if user.check_password(new_password):
                return jsonify({'error': 'New password must be different from current password'}), 400
            
            # Update password
            user.set_password(new_password)
            user.last_login = datetime.utcnow()  # Update last activity
            db.session.commit()
            
            return jsonify({'message': 'Password changed successfully'}), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to change password'}), 500
    
    return _change_password()

@auth_bp.route('/profile', methods=['GET'])
def get_profile():
    """Get current user's profile
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    responses:
      200:
        description: User profile information
        schema:
          type: object
          properties:
            id:
              type: integer
            username:
              type: string
            email:
              type: string
            is_admin:
              type: boolean
            created_at:
              type: string
            last_login:
              type: string
      401:
        description: Authentication required
    """
    from utils.jwt_auth import jwt_required, get_current_user_id
    
    @jwt_required
    def _get_profile():
        try:
            user_id = get_current_user_id()
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            return jsonify(user.to_dict()), 200
            
        except Exception as e:
            return jsonify({'error': 'Failed to fetch profile'}), 500
    
    return _get_profile()

@auth_bp.route('/profile', methods=['PUT'])
def update_profile():
    """Update current user's profile
    ---
    tags:
      - Auth
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            username:
              type: string
              minLength: 3
              maxLength: 80
            email:
              type: string
              format: email
          required:
            - username
            - email
    responses:
      200:
        description: Profile updated successfully
        schema:
          type: object
          properties:
            message:
              type: string
            user:
              type: object
      400:
        description: Validation error
      401:
        description: Authentication required
      409:
        description: Username or email already exists
    """
    from utils.jwt_auth import jwt_required, get_current_user_id
    from schemas import UserProfileUpdateSchema
    from marshmallow import ValidationError
    
    @jwt_required
    def _update_profile():
        try:
            # Validate request data
            schema = UserProfileUpdateSchema()
            try:
                data = schema.load(request.get_json())
            except ValidationError as err:
                return jsonify({'error': 'Validation failed', 'details': err.messages}), 400
            
            user_id = get_current_user_id()
            user = User.query.get(user_id)
            if not user:
                return jsonify({'error': 'User not found'}), 404
            
            username = data.get('username', '').strip()
            email = data.get('email', '').strip()
            
            # Check if username is taken by another user
            if username != user.username:
                existing_user = User.query.filter_by(username=username).first()
                if existing_user:
                    return jsonify({'error': 'Username already exists'}), 409
            
            # Check if email is taken by another user
            if email != user.email:
                existing_user = User.query.filter_by(email=email).first()
                if existing_user:
                    return jsonify({'error': 'Email already exists'}), 409
            
            # Update user information
            user.username = username
            user.email = email
            db.session.commit()
            
            return jsonify({
                'message': 'Profile updated successfully',
                'user': user.to_dict()
            }), 200
            
        except Exception as e:
            db.session.rollback()
            return jsonify({'error': 'Failed to update profile'}), 500
    
    return _update_profile()

@auth_bp.route('/forgot-password', methods=['POST'])
def forgot_password():
    """Request a password reset link
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - email
          properties:
            email:
              type: string
    responses:
      200:
        description: Reset link sent
      404:
        description: User not found
    """
    from utils.email_service import send_email
    import secrets
    from datetime import datetime, timedelta

    data = request.json
    email = data.get('email')

    if not email:
        return jsonify({'error': 'Email is required'}), 400

    user = User.query.filter_by(email=email).first()
    if not user:
        # For security, we don't want to reveal if a user exists
        return jsonify({'message': 'If your email is in our database, you will receive a reset link.'}), 200

    # Generate secure token
    token = secrets.token_urlsafe(32)
    user.reset_password_token = token
    user.reset_password_expires = datetime.utcnow() + timedelta(hours=1)
    db.session.commit()

    # Prepare reset link
    reset_link = f"{current_app.config.get('FRONTEND_URL', 'https://amankayare.com')}/reset-password/{token}"

    # Send email via microservice
    subject = "Reset Your Password - DEV47"
    body = f"""
    <h1>Password Reset Request</h1>
    <p>We received a request to reset your password for your DEV47 account.</p>
    <p>Click the link below to set a new password. This link will expire in 1 hour.</p>
    <a href="{reset_link}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>If you did not request this, please ignore this email.</p>
    """

    success = send_email(user.email, subject, body, is_html=True)
    
    if success:
        return jsonify({'message': 'Reset link sent successfully'}), 200
    else:
        return jsonify({'error': 'Failed to send reset email. Please try again later.'}), 500

@auth_bp.route('/reset-password', methods=['POST'])
def reset_password():
    """Reset password using token
    ---
    tags:
      - Auth
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - token
            - new_password
          properties:
            token:
              type: string
            new_password:
              type: string
    responses:
      200:
        description: Password reset successful
      400:
        description: Invalid or expired token
    """
    from datetime import datetime
    
    data = request.json
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify({'error': 'Token and new password are required'}), 400

    user = User.query.filter_by(reset_password_token=token).first()

    if not user or user.reset_password_expires < datetime.utcnow():
        return jsonify({'error': 'Invalid or expired reset token'}), 400

    # Update password and clear token
    user.set_password(new_password)
    user.reset_password_token = None
    user.reset_password_expires = None
    db.session.commit()

    return jsonify({'message': 'Password has been reset successfully'}), 200
