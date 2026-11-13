from flask import Blueprint, request, jsonify
from sqlalchemy.exc import IntegrityError
from marshmallow import ValidationError
from flasgger import swag_from

from models import db, Experience
from schemas import ExperienceSchema
from utils.jwt_auth import admin_required, get_current_user_admin_status

experiences_bp = Blueprint('experiences', __name__)
experience_schema = ExperienceSchema()
experiences_schema = ExperienceSchema(many=True)

@experiences_bp.route('/', methods=['GET'])
@swag_from({
    'tags': ['Experiences'],
    'summary': 'Get all visible experiences',
    'description': 'Retrieve all visible work experiences ordered by date',
    'responses': {
        200: {
            'description': 'List of experiences',
            'schema': {
                'type': 'array',
                'items': {
                    'type': 'object',
                    'properties': {
                        'id': {'type': 'integer'},
                        'title': {'type': 'string'},
                        'company': {'type': 'string'},
                        'location': {'type': 'string'},
                        'period': {'type': 'string'},
                        'duration': {'type': 'string'},
                        'responsibilities': {'type': 'array', 'items': {'type': 'string'}},
                        'achievements': {'type': 'array', 'items': {'type': 'string'}},
                        'technologies': {'type': 'array', 'items': {'type': 'string'}},
                        'color': {'type': 'string'}
                    }
                }
            }
        }
    }
})
def get_experiences():
    """Get all visible work experiences"""
    try:
        # VISIBILITY TOGGLE FIX: Check admin parameter explicitly
        is_admin_request = request.args.get('admin', '').lower() == 'true'
        
        # Query based on admin status
        if is_admin_request:
            # Admin management view: show ALL experiences including hidden
            experiences = Experience.query.order_by(Experience.order.desc(), Experience.start_date.desc()).all()
        else:
            # Public portfolio view: show only visible experiences
            experiences = Experience.query.filter_by(is_visible=True).order_by(Experience.order.desc(), Experience.start_date.desc()).all()
        
        return jsonify([exp.to_dict() for exp in experiences]), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@experiences_bp.route('/', methods=['POST'])
@admin_required
@swag_from({
    'tags': ['Experiences'],
    'summary': 'Create new experience',
    'description': 'Create a new work experience entry (Admin only)',
    'parameters': [{
        'in': 'body',
        'name': 'experience',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'title': {'type': 'string'},
                'company': {'type': 'string'},
                'location': {'type': 'string'},
                'start_date': {'type': 'string', 'format': 'date'},
                'end_date': {'type': 'string', 'format': 'date'},
                'is_current': {'type': 'boolean'},
                'duration': {'type': 'string'},
                'responsibilities': {'type': 'array', 'items': {'type': 'string'}},
                'achievements': {'type': 'array', 'items': {'type': 'string'}},
                'technologies': {'type': 'array', 'items': {'type': 'string'}},
                'color': {'type': 'string'},
                'order': {'type': 'integer'},
                'is_visible': {'type': 'boolean'}
            }
        }
    }],
    'responses': {
        201: {'description': 'Experience created successfully'},
        400: {'description': 'Validation error'},
        401: {'description': 'Unauthorized'}
    }
})
def create_experience():
    """Create a new work experience"""
    try:
        data = experience_schema.load(request.json)
        
        # If this experience is marked as current, unmark all other current experiences
        if data.get('is_current', False):
            Experience.query.filter_by(is_current=True).update({'is_current': False})
        
        experience = Experience(**data)
        db.session.add(experience)
        db.session.commit()
        
        return jsonify({
            'message': 'Experience created successfully',
            'experience': experience.to_dict()
        }), 201
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except IntegrityError:
        db.session.rollback()
        return jsonify({'error': 'Database constraint violation'}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@experiences_bp.route('/<int:experience_id>', methods=['GET'])
@swag_from({
    'tags': ['Experiences'],
    'summary': 'Get experience by ID',
    'description': 'Retrieve a specific work experience by ID',
    'parameters': [{
        'in': 'path',
        'name': 'experience_id',
        'type': 'integer',
        'required': True
    }],
    'responses': {
        200: {'description': 'Experience details'},
        404: {'description': 'Experience not found'}
    }
})
def get_experience(experience_id):
    """Get specific experience by ID"""
    experience = Experience.query.get_or_404(experience_id)
    return jsonify(experience.to_dict()), 200

@experiences_bp.route('/<int:experience_id>', methods=['PUT'])
@admin_required
@swag_from({
    'tags': ['Experiences'],
    'summary': 'Update experience',
    'description': 'Update a work experience entry (Admin only)',
    'parameters': [{
        'in': 'path',
        'name': 'experience_id',
        'type': 'integer',
        'required': True
    }, {
        'in': 'body',
        'name': 'experience',
        'required': True,
        'schema': {
            'type': 'object',
            'properties': {
                'title': {'type': 'string'},
                'company': {'type': 'string'},
                'location': {'type': 'string'},
                'start_date': {'type': 'string', 'format': 'date'},
                'end_date': {'type': 'string', 'format': 'date'},
                'is_current': {'type': 'boolean'},
                'duration': {'type': 'string'},
                'responsibilities': {'type': 'array', 'items': {'type': 'string'}},
                'achievements': {'type': 'array', 'items': {'type': 'string'}},
                'technologies': {'type': 'array', 'items': {'type': 'string'}},
                'color': {'type': 'string'},
                'order': {'type': 'integer'},
                'is_visible': {'type': 'boolean'}
            }
        }
    }],
    'responses': {
        200: {'description': 'Experience updated successfully'},
        400: {'description': 'Validation error'},
        401: {'description': 'Unauthorized'},
        404: {'description': 'Experience not found'}
    }
})
def update_experience(experience_id):
    """Update existing experience"""
    experience = Experience.query.get_or_404(experience_id)
    
    try:
        data = experience_schema.load(request.json, partial=True)
        
        # If this experience is being marked as current, unmark all other current experiences
        if data.get('is_current', False):
            Experience.query.filter(Experience.id != experience_id, Experience.is_current == True).update({'is_current': False})
        
        for key, value in data.items():
            setattr(experience, key, value)
        
        db.session.commit()
        
        return jsonify({
            'message': 'Experience updated successfully',
            'experience': experience.to_dict()
        }), 200
    except ValidationError as e:
        return jsonify({'error': e.messages}), 400
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@experiences_bp.route('/<int:experience_id>', methods=['DELETE'])
@admin_required
@swag_from({
    'tags': ['Experiences'],
    'summary': 'Delete experience',
    'description': 'Delete a work experience entry (Admin only)',
    'parameters': [{
        'in': 'path',
        'name': 'experience_id',
        'type': 'integer',
        'required': True
    }],
    'responses': {
        200: {'description': 'Experience deleted successfully'},
        401: {'description': 'Unauthorized'},
        404: {'description': 'Experience not found'}
    }
})
def delete_experience(experience_id):
    """Delete experience"""
    experience = Experience.query.get_or_404(experience_id)
    
    try:
        db.session.delete(experience)
        db.session.commit()
        return jsonify({'message': 'Experience deleted successfully'}), 200
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500