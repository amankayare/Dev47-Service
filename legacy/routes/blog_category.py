from flask import Blueprint, request, jsonify
from models import BlogCategory, db
from utils.jwt_auth import admin_required

blog_category_bp = Blueprint('blog_category', __name__)

@blog_category_bp.route('/', methods=['GET'])
def get_categories():
    categories = BlogCategory.query.order_by(BlogCategory.name.asc()).all()
    return jsonify([c.to_dict() for c in categories]), 200

@blog_category_bp.route('/', methods=['POST'])
@admin_required
def create_category():
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    if BlogCategory.query.filter_by(name=name).first():
        return jsonify({'error': 'Category already exists.'}), 400
    category = BlogCategory(name=name)
    db.session.add(category)
    db.session.commit()
    return jsonify(category.to_dict()), 201

@blog_category_bp.route('/<int:category_id>', methods=['PUT'])
@admin_required
def update_category(category_id):
    category = BlogCategory.query.get(category_id)
    if not category:
        return jsonify({'error': 'Category not found.'}), 404
    data = request.json
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Category name is required.'}), 400
    if BlogCategory.query.filter(BlogCategory.id != category_id, BlogCategory.name == name).first():
        return jsonify({'error': 'Category name already exists.'}), 400
    category.name = name
    db.session.commit()
    return jsonify(category.to_dict()), 200

@blog_category_bp.route('/<int:category_id>', methods=['DELETE'])
@admin_required
def delete_category(category_id):
    category = BlogCategory.query.get(category_id)
    if not category:
        return jsonify({'error': 'Category not found.'}), 404

    # Find or create 'General' category
    general_category = BlogCategory.query.filter_by(name='General').first()
    if not general_category:
        general_category = BlogCategory(name='General')
        db.session.add(general_category)
        db.session.commit()

    # Reassign all blogs to 'General' category
    from models import Blog
    Blog.query.filter_by(category_id=category_id).update({Blog.category_id: general_category.id})
    db.session.commit()

    db.session.delete(category)
    db.session.commit()
    return '', 204
