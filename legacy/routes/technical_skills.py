from flask import Blueprint, request, jsonify, current_app
from flasgger import swag_from
from models import db, TechnicalSkill
from schemas import TechnicalSkillSchema
from utils.jwt_auth import jwt_required, get_current_user_admin_status
from marshmallow import ValidationError

technical_skills_bp = Blueprint('technical_skills', __name__)
technical_skill_schema = TechnicalSkillSchema()
technical_skills_schema = TechnicalSkillSchema(many=True)

@technical_skills_bp.route('/api/technical-skills/', methods=['GET'])
@swag_from({
    'tags': ['Technical Skills'],
    'summary': 'Get all technical skills',
    'description': 'Retrieve all technical skill categories with their skills arrays',
    'responses': {
        200: {
            'description': 'List of technical skills retrieved successfully',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'title': {'type': 'string'},
                        'skills': {
                            'type': 'array',
                            'items': {'type': 'string'}
                        },
                        'color': {'type': 'string'},
                        'icon': {'type': 'string'},
                        'order': {'type': 'integer'},
                        'is_visible': {'type': 'boolean'}
                    }
                }
            }
        }
    }
})
def get_technical_skills():
    """Get all technical skills ordered by order field"""
    try:
        # VISIBILITY TOGGLE FIX: Check admin parameter explicitly
        is_admin_request = request.args.get('admin', '').lower() == 'true'
        
        # Query based on admin status
        if is_admin_request:
            # Admin management view: show ALL skills including hidden
            skills = TechnicalSkill.query.order_by(TechnicalSkill.order).all()
        else:
            # Public portfolio view: show only visible skills
            skills = TechnicalSkill.query.filter_by(is_visible=True).order_by(TechnicalSkill.order).all()
        
        return jsonify([skill.to_dict() for skill in skills]), 200
    except Exception as e:
        current_app.logger.error(f"Error fetching technical skills: {str(e)}")
        return jsonify({'error': 'Failed to fetch technical skills'}), 500

@technical_skills_bp.route('/api/technical-skills/', methods=['POST'])
@jwt_required
@swag_from({
    'tags': ['Technical Skills'],
    'summary': 'Create a new technical skill category',
    'description': 'Create a new technical skill category (Admin only)',
    'parameters': [{
        'name': 'Authorization',
        'in': 'header',
        'type': 'string',
        'required': True,
        'description': 'Bearer token for authentication'
    }],
    'consumes': ['application/json'],
    'produces': ['application/json'],
    'definitions': {
        'TechnicalSkillInput': {
            'type': 'object',
            'required': ['title'],
            'properties': {
                'title': {'type': 'string'},
                'skills': {
                    'type': 'array',
                    'items': {'type': 'string'}
                },
                'color': {'type': 'string'},
                'icon': {'type': 'string'},
                'order': {'type': 'integer'},
                'is_visible': {'type': 'boolean', 'default': True}
            }
        }
    },
    'parameters': [{
        'name': 'technical_skill',
        'in': 'body',
        'required': True,
        'schema': {'$ref': '#/definitions/TechnicalSkillInput'}
    }],
    'responses': {
        201: {
            'description': 'Technical skill created successfully'
        },
        400: {
            'description': 'Invalid input data'
        },
        401: {
            'description': 'Authentication required'
        }
    }
})
def create_technical_skill():
    """Create a new technical skill category"""
    try:
        data = technical_skill_schema.load(request.json)
        
        skill = TechnicalSkill(
            title=data['title'],
            skills=data.get('skills', []),
            color=data.get('color'),
            icon=data.get('icon'),
            order=data.get('order', 0),
            is_visible=data.get('is_visible', True)
        )
        
        db.session.add(skill)
        db.session.commit()
        
        return jsonify(skill.to_dict()), 201
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating technical skill: {str(e)}")
        return jsonify({'error': 'Failed to create technical skill'}), 500

@technical_skills_bp.route('/api/technical-skills/<int:skill_id>', methods=['PUT'])
@jwt_required
@swag_from({
    'tags': ['Technical Skills'],
    'summary': 'Update a technical skill category',
    'description': 'Update an existing technical skill category (Admin only)',
    'parameters': [{
        'name': 'Authorization',
        'in': 'header',
        'type': 'string',
        'required': True,
        'description': 'Bearer token for authentication'
    }, {
        'name': 'skill_id',
        'in': 'path',
        'type': 'integer',
        'required': True,
        'description': 'Technical skill ID'
    }],
    'responses': {
        200: {
            'description': 'Technical skill updated successfully'
        },
        404: {
            'description': 'Technical skill not found'
        },
        401: {
            'description': 'Authentication required'
        }
    }
})
def update_technical_skill(skill_id):
    """Update an existing technical skill category"""
    try:
        skill = TechnicalSkill.query.get_or_404(skill_id)
        data = technical_skill_schema.load(request.json, partial=True)
        
        for key, value in data.items():
            setattr(skill, key, value)
        
        db.session.commit()
        return jsonify(skill.to_dict()), 200
        
    except ValidationError as e:
        return jsonify({'error': 'Validation failed', 'details': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating technical skill: {str(e)}")
        return jsonify({'error': 'Failed to update technical skill'}), 500

@technical_skills_bp.route('/api/technical-skills/<int:skill_id>', methods=['DELETE'])
@jwt_required
@swag_from({
    'tags': ['Technical Skills'],
    'summary': 'Delete a technical skill category',
    'description': 'Delete a technical skill category (Admin only)',
    'parameters': [{
        'name': 'Authorization',
        'in': 'header',
        'type': 'string',
        'required': True,
        'description': 'Bearer token for authentication'
    }, {
        'name': 'skill_id',
        'in': 'path',
        'type': 'integer',
        'required': True,
        'description': 'Technical skill ID'
    }],
    'responses': {
        200: {
            'description': 'Technical skill deleted successfully'
        },
        404: {
            'description': 'Technical skill not found'
        },
        401: {
            'description': 'Authentication required'
        }
    }
})
def delete_technical_skill(skill_id):
    """Delete a technical skill category"""
    try:
        skill = TechnicalSkill.query.get_or_404(skill_id)
        db.session.delete(skill)
        db.session.commit()
        
        return jsonify({'message': 'Technical skill deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting technical skill: {str(e)}")
        return jsonify({'error': 'Failed to delete technical skill'}), 500



