from flask import Blueprint, request, jsonify
from models import User, Blog, Certification, About, ContactMessage, Project, db
from utils.jwt_auth import admin_required
from schemas import CertificationSchema, AboutSchema
from marshmallow import ValidationError

admin_bp = Blueprint('admin', __name__)

@admin_bp.route('/dashboard', methods=['GET'])
@admin_required
def admin_dashboard():
    """Get admin dashboard stats
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    responses:
      200:
        description: Dashboard statistics
      403:
        description: Admin access required
    """
    stats = {
        'projects_count': Project.query.count(),
        'blogs_count': db.session.query(db.func.count(Blog.id)).scalar(),
        'certifications_count': Certification.query.count(),
        'contact_messages_count': ContactMessage.query.count(),
        'unseen_messages_count': ContactMessage.query.filter_by(is_read=False).count(),
        'users_count': User.query.count()
    }
    return jsonify(stats), 200


@admin_bp.route('/users', methods=['GET'])
@admin_required
def admin_get_users():
    """Get all users for admin management
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    responses:
      200:
        description: List of all users
      403:
        description: Admin access required
    """
    # Pagination params
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
    except ValueError:
        page = 1
        page_size = 10

    search = request.args.get('search', '').strip()
    query = User.query
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (User.username.ilike(search_pattern)) |
            (User.email.ilike(search_pattern))
        )
    query = query.order_by(User.created_at.desc())
    total = query.count()
    users = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size

    return jsonify({
        'users': [u.to_dict() for u in users],
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages
    }), 200

@admin_bp.route('/users/<int:user_id>/toggle-admin', methods=['PUT'])
@admin_required
def admin_toggle_user_admin(user_id):
    """Toggle admin status for a user
    ---
    tags:
      - Admin
    security:
      - Bearer: []
    parameters:
      - in: path
        name: user_id
        required: true
        schema:
          type: integer
    responses:
      200:
        description: User admin status updated
      404:
        description: User not found
      403:
        description: Admin access required
    """
    try:
        user = User.query.get_or_404(user_id)
        user.is_admin = not user.is_admin
        db.session.commit()
        return jsonify({'message': f'User admin status updated', 'user': user.to_dict()}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to update user admin status'}), 500