from flask import Blueprint, request, jsonify
from utils.jwt_auth import jwt_required, get_current_user_id
from sqlalchemy.orm import joinedload
from models import Comment, User, Blog, db
from schemas import CommentSchema
from datetime import datetime

comments_bp = Blueprint('comments', __name__)
comment_schema = CommentSchema()
comments_schema = CommentSchema(many=True)

@comments_bp.route('/blogs/<int:blog_id>/comments', methods=['GET'])
def get_comments(blog_id):
    """Get all comments for a specific blog post"""
    try:
        # Verify blog exists
        blog = Blog.query.get_or_404(blog_id)
        
        # Get all comments for this blog (we'll build the hierarchy manually)
        all_comments = Comment.query.filter_by(blog_id=blog_id).options(
            joinedload(Comment.author)
        ).order_by(Comment.created_at.asc()).all()
        
        # Build nested comment structure manually
        comments_dict = {}
        top_level_comments = []
        
        # First pass: create all comment objects
        for comment in all_comments:
            comment_data = {
                'id': comment.id,
                'content': comment.content,
                'created_at': comment.created_at.isoformat(),
                'updated_at': comment.updated_at.isoformat(),
                'parent_id': comment.parent_id,
                'author': {
                    'id': comment.author.id,
                    'username': comment.author.username,
                    'is_admin': comment.author.is_admin
                },
                'replies': []
            }
            comments_dict[comment.id] = comment_data
            
            if comment.parent_id is None:
                top_level_comments.append(comment_data)
        
        # Second pass: build hierarchy
        for comment in all_comments:
            if comment.parent_id is not None:
                parent = comments_dict.get(comment.parent_id)
                if parent:
                    parent['replies'].append(comments_dict[comment.id])
        
        # Sort top-level comments by creation date (newest first)
        top_level_comments.sort(key=lambda x: x['created_at'], reverse=True)
        
        return jsonify(top_level_comments), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@comments_bp.route('/blogs/<int:blog_id>/comments', methods=['POST'])
@jwt_required
def add_comment(blog_id):
    """Add a new comment to a blog post"""
    try:
        # Get current user
        current_user_id = get_current_user_id()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Verify blog exists
        blog = Blog.query.get_or_404(blog_id)
        
        # Get request data
        data = request.get_json()
        
        if not data or not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400
        
        content = data.get('content').strip()
        parent_id = data.get('parent_id')
        
        if len(content) < 1:
            return jsonify({'error': 'Content cannot be empty'}), 400
        
        if len(content) > 2000:
            return jsonify({'error': 'Content too long (max 2000 characters)'}), 400
        
        # If parent_id is provided, verify parent comment exists
        if parent_id:
            parent_comment = Comment.query.filter_by(id=parent_id, blog_id=blog_id).first()
            if not parent_comment:
                return jsonify({'error': 'Parent comment not found'}), 404
        
        # Create new comment
        new_comment = Comment(
            content=content,
            author_id=current_user_id,
            blog_id=blog_id,
            parent_id=parent_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        db.session.add(new_comment)
        db.session.commit()
        
        # Return the created comment with author info
        result = {
            'id': new_comment.id,
            'content': new_comment.content,
            'created_at': new_comment.created_at.isoformat(),
            'updated_at': new_comment.updated_at.isoformat(),
            'parent_id': new_comment.parent_id,
            'author': {
                'id': user.id,
                'username': user.username,
                'is_admin': user.is_admin
            }
        }
        
        return jsonify(result), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@comments_bp.route('/comments/<int:comment_id>', methods=['PUT'])
@jwt_required
def update_comment(comment_id):
    """Update a comment (only by the author or admin)"""
    try:
        current_user_id = get_current_user_id()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        comment = Comment.query.get_or_404(comment_id)
        
        # Check if user can edit this comment
        if comment.author_id != current_user_id and not user.is_admin:
            return jsonify({'error': 'Not authorized to edit this comment'}), 403
        
        data = request.get_json()
        
        if not data or not data.get('content'):
            return jsonify({'error': 'Content is required'}), 400
        
        content = data.get('content').strip()
        
        if len(content) < 1:
            return jsonify({'error': 'Content cannot be empty'}), 400
        
        if len(content) > 2000:
            return jsonify({'error': 'Content too long (max 2000 characters)'}), 400
        
        comment.content = content
        comment.updated_at = datetime.utcnow()
        
        db.session.commit()
        
        return jsonify({'message': 'Comment updated successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@comments_bp.route('/comments/<int:comment_id>', methods=['DELETE'])
@jwt_required
def delete_comment(comment_id):
    """Delete a comment (only by the author or admin)"""
    try:
        current_user_id = get_current_user_id()
        user = User.query.get(current_user_id)
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        comment = Comment.query.get_or_404(comment_id)
        
        # Check if user can delete this comment
        if comment.author_id != current_user_id and not user.is_admin:
            return jsonify({'error': 'Not authorized to delete this comment'}), 403
        
        # Delete comment and all its replies
        def delete_comment_tree(comment):
            for reply in comment.replies:
                delete_comment_tree(reply)
            db.session.delete(comment)
        
        delete_comment_tree(comment)
        db.session.commit()
        
        return jsonify({'message': 'Comment deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500
