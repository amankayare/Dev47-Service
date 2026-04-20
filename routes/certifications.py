from flask import Blueprint, request, jsonify

from models import Certification, db

from utils.security import sanitize_input
from utils.jwt_auth import jwt_required, admin_required

certifications_bp = Blueprint('certifications', __name__)


@certifications_bp.route('/', methods=['GET'])
def get_certifications():
    """List all certifications
    ---
    tags:
      - Certifications
    security:
      - Bearer: []
    responses:
      200:
        description: List of certifications
    """
    certifications = Certification.query.all()
    return jsonify([c.to_dict() for c in certifications]), 200

@certifications_bp.route('/', methods=['POST'])
@admin_required
def create_certification():
    """Create a new certification
    ---
    tags:
      - Certifications
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
            - issuer
            - date
            - credential_url
          properties:
            name:
              type: string
              description: Certification name
            issuer:
              type: string
              description: Issuing organization
            date:
              type: string
              format: date
              description: Date awarded (YYYY-MM-DD)
            credential_url:
              type: string
              description: Credential verification URL
            skills:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Skill ID
                  name:
                    type: string
                    description: Skill name
              description: List of skill objects
            certificate_id:
              type: string
              description: Certificate ID
            expiration_date:
              type: string
              format: date
              description: Expiration date (YYYY-MM-DD)
            description:
              type: string
              description: Certification description
    security:
      - Bearer: []
    responses:
      201:
        description: Certification created
      400:
        description: Invalid request
    """
    try:
        data = request.json
        from datetime import datetime
        # Parse skills as array of objects (with at least name/id)
        skills_objs = data.get('skills', [])
        skills = []
        if isinstance(skills_objs, list):
            for skill in skills_objs:
                if isinstance(skill, dict):
                    skills.append(skill.get('name') or skill.get('id'))
                else:
                    skills.append(skill)
        cert = Certification(
            name=sanitize_input(data['name']),
            issuer=sanitize_input(data['issuer']),
            date=sanitize_input(data.get('date', '')),
            credential_url=sanitize_input(data.get('credential_url', '')),
            description=sanitize_input(data.get('description', '')),
            skills=skills,
            certificate_id=sanitize_input(data.get('certificate_id', '')),
            expiration_date=datetime.fromisoformat(data['expiration_date']) if data.get('expiration_date') else None,
            is_visible=data.get('is_visible', True)
        )
        db.session.add(cert)
        db.session.commit()
        return jsonify(cert.to_dict()), 201
    except Exception as err:
        return jsonify({"errors": err}), 400

@certifications_bp.route('/<int:cert_id>', methods=['PUT'])
@admin_required
def update_certification(cert_id):
    """Update a certification by ID
    ---
    tags:
      - Certifications
    security:
      - Bearer: []
    parameters:
      - in: path
        name: cert_id
        schema:
          type: integer
        required: true
        description: Certification ID
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              description: Certification name
            issuer:
              type: string
              description: Issuing organization
            date:
              type: string
              format: date
              description: Date awarded (YYYY-MM-DD)
            credential_url:
              type: string
              description: Credential verification URL
    responses:
      200:
        description: Certification updated
      400:
        description: Invalid request
      404:
        description: Certification not found
    """

    try:
        cert = Certification.query.get(cert_id)
        if not cert:
            return jsonify({"error": "Certification not found"}), 404
        data = request.json
        from datetime import datetime
        for field in ['name', 'issuer', 'credential_url', 'description', 'certificate_id']:
            if field in data:
                setattr(cert, field, sanitize_input(data[field]))
        if 'is_visible' in data:
            cert.is_visible = data['is_visible']
        if 'date' in data:
            date_str = data['date']
            try:
                from datetime import datetime
                cert.date = datetime.fromisoformat(date_str) if date_str else None
            except Exception:
                cert.date = None
        # Parse skills as array of objects (with at least name/id)
        if 'skills' in data:
            skills_objs = data['skills']
            skills = []
            if isinstance(skills_objs, list):
                for skill in skills_objs:
                    if isinstance(skill, dict):
                        skills.append(skill.get('name') or skill.get('id'))
                    else:
                        skills.append(skill)
            cert.skills = skills
        if 'expiration_date' in data:
            cert.expiration_date = datetime.fromisoformat(data['expiration_date']) if data['expiration_date'] else None
        db.session.commit()
        return jsonify(cert.to_dict()), 200
    except Exception as err:
        return jsonify({"errors": err}), 400
@certifications_bp.route('/<int:cert_id>', methods=['DELETE'])
@admin_required
def delete_certification(cert_id):
    """Delete a certification by ID
    ---
    tags:
      - Certifications
    security:
      - Bearer: []
    parameters:
      - in: path
        name: cert_id
        schema:
          type: integer
        required: true
        description: Certification ID
    security:
      - Bearer: []
    responses:
      204:
        description: Certification deleted
      404:
        description: Certification not found
    """
    cert = Certification.query.get(cert_id)
    if not cert:
        return jsonify({"error": "Certification not found"}), 404
    db.session.delete(cert)
    db.session.commit()
    return '', 204
