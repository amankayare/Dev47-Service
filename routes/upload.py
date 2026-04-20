import os
import uuid
from flask import Blueprint, request, jsonify, current_app
from werkzeug.utils import secure_filename
from utils.jwt_auth import jwt_required
import mimetypes

upload_bp = Blueprint('upload', __name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'webp', 'pdf'}  # Added PDF for resume
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

def allowed_file(filename, upload_type='image'):
    """Check if file extension is allowed based on upload type"""
    if not '.' in filename:
        return False
    
    extension = filename.rsplit('.', 1)[1].lower()
    
    # For resume uploads, only allow PDF
    if upload_type == 'resume':
        return extension == 'pdf'
    
    # For image uploads, allow image formats
    return extension in {'png', 'jpg', 'jpeg', 'gif', 'webp'}

def create_upload_directory():
    """Create upload directory if it doesn't exist"""
    upload_dir = os.path.join(current_app.static_folder, UPLOAD_FOLDER)
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

@upload_bp.route('/<upload_type>', methods=['POST'])
@jwt_required
def upload_image(upload_type):
    """Upload file for different purposes
    ---
    tags:
      - Upload
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - in: path
        name: upload_type
        type: string
        required: true
        description: Type of upload (profile, cover, project, certificate, resume)
        enum: [profile, cover, project, certificate, resume]
      - in: formData
        name: file
        type: file
        required: true
        description: File to upload (Images for profile/cover/project/certificate - PNG, JPG, JPEG, GIF, WEBP; Resume - PDF only, max 5MB)
    responses:
      200:
        description: File uploaded successfully
        schema:
          type: object
          properties:
            url:
              type: string
              description: URL of the uploaded file
            filename:
              type: string
              description: Generated filename
            message:
              type: string
              description: Success message
      400:
        description: Invalid file, missing file, or invalid upload type
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
      413:
        description: File too large
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
      500:
        description: Upload failed due to server error
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
    """
    try:
        # Valid upload types
        valid_types = ['profile', 'cover', 'project', 'certificate', 'resume']
        if upload_type not in valid_types:
            return jsonify({"error": f"Invalid upload type. Must be one of: {', '.join(valid_types)}"}), 400
            
        # Check if file is present
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400
        
        file = request.files['file']
        
        # Check if file is selected
        if file.filename == '':
            return jsonify({"error": "No file selected"}), 400
        
        # Check file size
        file.seek(0, os.SEEK_END)
        file_size = file.tell()
        file.seek(0)
        
        if file_size > MAX_FILE_SIZE:
            return jsonify({"error": f"File too large. Maximum size is {MAX_FILE_SIZE // (1024*1024)}MB"}), 413
        
        # Check file type
        if not allowed_file(file.filename, upload_type):
            if upload_type == 'resume':
                return jsonify({"error": "Invalid file type. Resume must be PDF"}), 400
            else:
                return jsonify({"error": "Invalid file type. Allowed types: PNG, JPG, JPEG, GIF, WEBP"}), 400
        
        # Validate file content type
        if upload_type == 'resume':
            if not file.content_type == 'application/pdf':
                return jsonify({"error": "File must be a PDF"}), 400
        else:
            if not file.content_type.startswith('image/'):
                return jsonify({"error": "File must be an image"}), 400
        
        # Create upload directory
        upload_dir = create_upload_directory()
        
        # Generate unique filename with proper prefix
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"{upload_type}_{uuid.uuid4().hex}.{file_extension}"
        secure_name = secure_filename(unique_filename)
        
        # Save file
        file_path = os.path.join(upload_dir, secure_name)
        file.save(file_path)
        
        # Generate URL for the uploaded file
        file_url = f"/static/{UPLOAD_FOLDER}/{secure_name}"
        
        return jsonify({
            "url": file_url,
            "filename": secure_name,
            "message": f"{upload_type.title()} {'file' if upload_type == 'resume' else 'image'} uploaded successfully"
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@upload_bp.route('/delete/<filename>', methods=['DELETE'])
@jwt_required
def delete_uploaded_file(filename):
    """Delete uploaded file
    ---
    tags:
      - Upload
    security:
      - Bearer: []
    parameters:
      - in: path
        name: filename
        type: string
        required: true
        description: Filename to delete
    responses:
      200:
        description: File deleted successfully
        schema:
          type: object
          properties:
            message:
              type: string
              description: Success message
      400:
        description: Invalid filename
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
      404:
        description: File not found
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
      500:
        description: Delete failed due to server error
        schema:
          type: object
          properties:
            error:
              type: string
              description: Error message
    """
    try:
        # Secure the filename
        secure_name = secure_filename(filename)
        
        # Check if filename starts with allowed prefix (security measure)
        allowed_prefixes = ['profile_', 'cover_', 'project_', 'certificate_', 'resume_']
        if not any(secure_name.startswith(prefix) for prefix in allowed_prefixes):
            return jsonify({"error": "Invalid filename"}), 400
        
        upload_dir = os.path.join(current_app.static_folder, UPLOAD_FOLDER)
        file_path = os.path.join(upload_dir, secure_name)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"message": "File deleted successfully"}), 200
        else:
            return jsonify({"error": "File not found"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500
