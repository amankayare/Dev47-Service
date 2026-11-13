from flask import Blueprint, send_file, current_app, abort, request, jsonify, redirect
import os
import uuid
from werkzeug.utils import secure_filename
from utils.jwt_auth import jwt_required
from models import About

resume_bp = Blueprint('resume', __name__)

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB for resume

def allowed_file(filename):
    """Check if file extension is allowed for resume"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def create_upload_directory():
    """Create upload directory if it doesn't exist"""
    upload_dir = os.path.join(current_app.static_folder, UPLOAD_FOLDER)
    if not os.path.exists(upload_dir):
        os.makedirs(upload_dir, exist_ok=True)
    return upload_dir

@resume_bp.route('/', methods=['GET'])
def get_resume():
    """Download resume PDF
    ---
    tags:
      - Resume

    responses:
      200:
        description: Resume PDF file
        content:
          application/pdf:
            schema:
              type: string
              format: binary
      302:
        description: Redirect to external resume URL
      404:
        description: Resume not found
    """
    try:
        # Get resume URL from About table
        about = About.query.first()
        
        if not about:
            # No About record found, try fallback
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=True, download_name="Aman_Kayare_Resume.pdf")
            else:
                abort(404, description="No resume found. Please upload a resume through the admin panel.")
        
        if not about.resume_url:
            # No resume URL set, try fallback
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf") 
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=True, download_name="Aman_Kayare_Resume.pdf")
            else:
                abort(404, description="No resume URL configured. Please upload a resume through the admin panel.")
        
        resume_url = about.resume_url.strip()
        
        # If it's an uploaded file (starts with /static/uploads/)
        if resume_url.startswith('/static/uploads/'):
            # Serve the uploaded file
            filename = resume_url.split('/')[-1]
            uploads_dir = os.path.join(current_app.static_folder, 'uploads')
            file_path = os.path.join(uploads_dir, filename)
            
            # Create uploads directory if it doesn't exist
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir, exist_ok=True)
            
            if os.path.exists(file_path):
                return send_file(file_path, as_attachment=True, download_name="Aman_Kayare_Resume.pdf")
            else:
                # Try fallback if uploaded file is missing
                resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
                if os.path.exists(resume_path):
                    return send_file(resume_path, as_attachment=True, download_name="Aman_Kayare_Resume.pdf")
                else:
                    abort(404, description=f"Resume file not found at {file_path}. Please re-upload through the admin panel.")
        else:
            # For external URLs, redirect to the URL
            return redirect(resume_url)
            
    except Exception as e:
        # Try fallback on any error
        try:
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=True, download_name="Aman_Kayare_Resume.pdf")
        except:
            pass
        
        abort(500, description=f"Error retrieving resume: {str(e)}")

@resume_bp.route('/view', methods=['GET'])
def view_resume():
    """View resume PDF online
    ---
    tags:
      - Resume

    responses:
      200:
        description: Resume PDF for viewing
        content:
          application/pdf:
            schema:
              type: string
              format: binary
      302:
        description: Redirect to external resume URL
      404:
        description: Resume not found
    """
    try:
        # Get resume URL from About table
        about = About.query.first()
        
        if not about:
            # No About record found, try fallback
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=False)
            else:
                abort(404, description="No resume found. Please upload a resume through the admin panel.")
        
        if not about.resume_url:
            # No resume URL set, try fallback
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=False)
            else:
                abort(404, description="No resume URL configured. Please upload a resume through the admin panel.")
        
        resume_url = about.resume_url.strip()
        
        # If it's an uploaded file (starts with /static/uploads/)
        if resume_url.startswith('/static/uploads/'):
            # Serve the uploaded file for viewing
            filename = resume_url.split('/')[-1]
            uploads_dir = os.path.join(current_app.static_folder, 'uploads')
            file_path = os.path.join(uploads_dir, filename)
            
            # Create uploads directory if it doesn't exist
            if not os.path.exists(uploads_dir):
                os.makedirs(uploads_dir, exist_ok=True)
            
            if os.path.exists(file_path):
                return send_file(file_path, as_attachment=False)
            else:
                # Try fallback if uploaded file is missing
                resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
                if os.path.exists(resume_path):
                    return send_file(resume_path, as_attachment=False)
                else:
                    abort(404, description=f"Resume file not found at {file_path}. Please re-upload through the admin panel.")
        else:
            # For external URLs, redirect to the URL
            return redirect(resume_url)
            
    except Exception as e:
        # Try fallback on any error
        try:
            resume_path = current_app.config.get("RESUME_PATH", "./resume.pdf")
            if os.path.exists(resume_path):
                return send_file(resume_path, as_attachment=False)
        except:
            pass
        
        abort(500, description=f"Error retrieving resume: {str(e)}")

@resume_bp.route('/upload', methods=['POST'])
@jwt_required
def upload_resume():
    """Upload resume PDF file
    ---
    tags:
      - Resume
    security:
      - Bearer: []
    consumes:
      - multipart/form-data
    parameters:
      - in: formData
        name: file
        type: file
        required: true
        description: Resume PDF file (max 10MB)
    responses:
      200:
        description: Resume uploaded successfully
        schema:
          type: object
          properties:
            url:
              type: string
              description: URL of the uploaded resume
            filename:
              type: string
              description: Generated filename
            message:
              type: string
              description: Success message
      400:
        description: Invalid file, missing file, or invalid file type
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
        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type. Only PDF files are allowed"}), 400
        
        # Validate file content type
        if not file.content_type == 'application/pdf':
            return jsonify({"error": "File must be a PDF"}), 400
        
        # Create upload directory
        upload_dir = create_upload_directory()
        
        # Generate unique filename
        file_extension = file.filename.rsplit('.', 1)[1].lower()
        unique_filename = f"resume_{uuid.uuid4().hex}.{file_extension}"
        secure_name = secure_filename(unique_filename)
        
        # Save file
        file_path = os.path.join(upload_dir, secure_name)
        file.save(file_path)
        
        # Generate URL for the uploaded file
        file_url = f"/static/{UPLOAD_FOLDER}/{secure_name}"
        
        return jsonify({
            "url": file_url,
            "filename": secure_name,
            "message": "Resume uploaded successfully"
        }), 200
        
    except Exception as e:
        return jsonify({"error": f"Upload failed: {str(e)}"}), 500

@resume_bp.route('/delete/<filename>', methods=['DELETE'])
@jwt_required
def delete_resume(filename):
    """Delete uploaded resume file
    ---
    tags:
      - Resume
    security:
      - Bearer: []
    parameters:
      - in: path
        name: filename
        type: string
        required: true
        description: Resume filename to delete
    responses:
      200:
        description: Resume deleted successfully
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
        description: Resume file not found
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
        
        # Check if filename starts with resume prefix (security measure)
        if not secure_name.startswith('resume_'):
            return jsonify({"error": "Invalid filename"}), 400
        
        upload_dir = os.path.join(current_app.static_folder, UPLOAD_FOLDER)
        file_path = os.path.join(upload_dir, secure_name)
        
        if os.path.exists(file_path):
            os.remove(file_path)
            return jsonify({"message": "Resume deleted successfully"}), 200
        else:
            return jsonify({"error": "Resume file not found"}), 404
            
    except Exception as e:
        return jsonify({"error": f"Delete failed: {str(e)}"}), 500

@resume_bp.route('/debug', methods=['GET'])
def debug_resume():
    """Debug resume information
    ---
    tags:
      - Resume
    responses:
      200:
        description: Resume debug information
        schema:
          type: object
          properties:
            about_exists:
              type: boolean
            resume_url:
              type: string
            uploads_dir:
              type: string
            static_folder:
              type: string
            file_exists:
              type: boolean
    """
    try:
        about = About.query.first()
        uploads_dir = os.path.join(current_app.static_folder, 'uploads') if current_app.static_folder else None
        
        debug_info = {
            "about_exists": about is not None,
            "resume_url": about.resume_url if about else None,
            "uploads_dir": uploads_dir,
            "static_folder": current_app.static_folder,
            "uploads_dir_exists": os.path.exists(uploads_dir) if uploads_dir else False,
            "file_exists": False,
            "file_path": None
        }
        
        if about and about.resume_url and about.resume_url.startswith('/static/uploads/'):
            filename = about.resume_url.split('/')[-1]
            file_path = os.path.join(uploads_dir, filename) if uploads_dir else None
            debug_info["file_path"] = file_path
            debug_info["file_exists"] = os.path.exists(file_path) if file_path else False
            
            if uploads_dir and os.path.exists(uploads_dir):
                debug_info["uploads_files"] = os.listdir(uploads_dir)
            
        return jsonify(debug_info), 200
        
    except Exception as e:
        return jsonify({"error": str(e)}), 500
