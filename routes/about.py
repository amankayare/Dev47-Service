from flask import Blueprint, request, jsonify
from models import About, db


from utils.security import sanitize_input
from utils.jwt_auth import jwt_required, admin_required

about_bp = Blueprint('about', __name__)


@about_bp.route('/', methods=['GET'])
def get_about():
    """Get about information
    ---
    tags:
      - About
    security:
      - Bearer: []
    responses:
      200:
        description: About info
      404:
        description: Not found
    """
    try:
        about = About.query.first()
        if not about:
            return jsonify({}), 200
        return jsonify(about.to_dict()), 200
    except Exception as e:
        return jsonify({"errors": str(e)}), 400

@about_bp.route('/', methods=['POST'])
@jwt_required
def create_about():
    """Create about information (only one allowed)
    ---
    tags:
      - About
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object

          properties:
            name:
              type: string
              description: Full name
            headline:
              type: string
              description: Professional headline or title
            bio:
              type: string
              description: Short biography/about text
            photo:
              type: string
              description: URL to profile picture
            cover_image:
              type: string
              description: URL to cover/banner image
            location:
              type: string
              description: Location
            email:
              type: string
              description: Email address
            phone:
              type: string
              description: Phone number
            birthday:
              type: string
              format: date
              description: Birthday (YYYY-MM-DD)
            resume_url:
              type: string
              description: URL to resume or CV
            social_links:
              type: object
              description: Social links (e.g. LinkedIn, GitHub)
              properties:
                linkedin:
                  type: string
                  description: LinkedIn profile URL
                github:
                  type: string
                  description: GitHub profile URL
              additionalProperties:
                type: string
    responses:
      201:
        description: About created
      400:
        description: About already exists or validation error
    """

    try:
        # Only one about entry allowed
        if About.query.first():
            return jsonify({"error": "About info already exists. Use PUT to update."}), 400
        data = request.json
        about = About(
            name=sanitize_input(data.get('name', '')),
            headline=sanitize_input(data.get('headline', '')),
            bio=sanitize_input(data.get('bio', '')),
            photo=sanitize_input(data.get('photo', '')),
            cover_image=sanitize_input(data.get('cover_image', '')),
            location=sanitize_input(data.get('location', '')),
            email=sanitize_input(data.get('email', '')),
            phone=sanitize_input(data.get('phone', '')),
            resume_url=sanitize_input(data.get('resume_url', '')),
            social_links=sanitize_input(data.get('social_links', '')),
        )
        db.session.add(about)
        db.session.commit()
        return jsonify(about.to_dict()), 201
    except Exception as e:
        return jsonify({"errors": str(e)}), 400

@about_bp.route('/', methods=['PUT'])
@jwt_required
def update_about():
    """Update about information
    ---
    tags:
      - About
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            name:
              type: string
              description: Full name
            headline:
              type: string
              description: Professional headline or title
            bio:
              type: string
              description: Short biography/about text
            photo:
              type: string
              description: URL to profile picture
            cover_image:
              type: string
              description: URL to cover/banner image
            location:
              type: string
              description: Location
            email:
              type: string
              description: Email address
            phone:
              type: string
              description: Phone number
            birthday:
              type: string
              format: date
              description: Birthday (YYYY-MM-DD)
            resume_url:
              type: string
              description: URL to resume or CV
            social_links:
              type: object
              description: Social links (e.g. LinkedIn, GitHub)
              properties:
                linkedin:
                  type: string
                  description: LinkedIn profile URL
                github:
                  type: string
                  description: GitHub profile URL
              additionalProperties:
                type: string
    responses:
      200:
        description: About updated
      404:
        description: Not found
    """

    try:
        about = About.query.first()
        if not about:
            return jsonify({"error": "About info not found"}), 404
        data = request.json
        from datetime import datetime
        
        # Update all available fields
        if 'name' in data:
            about.name = sanitize_input(data['name'])
        if 'headline' in data:
            about.headline = sanitize_input(data['headline'])
        if 'bio' in data:
            about.bio = sanitize_input(data['bio'])
        if 'photo' in data:
            about.photo = sanitize_input(data['photo'])
        if 'cover_image' in data:
            about.cover_image = sanitize_input(data['cover_image'])
        if 'location' in data:
            about.location = sanitize_input(data['location'])
        if 'email' in data:
            about.email = sanitize_input(data['email'])
        if 'phone' in data:
            about.phone = sanitize_input(data['phone'])
        if 'resume_url' in data:
            about.resume_url = sanitize_input(data['resume_url'])
        if 'social_links' in data:
            about.social_links = data['social_links']  # Already parsed as dict from frontend
            
        db.session.commit()
        return jsonify(about.to_dict()), 200
    except Exception as e:
        return jsonify({"errors": str(e)}), 400


@about_bp.route('/', methods=['DELETE'])
@jwt_required
def delete_about():
    """Delete about information
    ---
    tags:
      - About
    security:
      - Bearer: []
    security:
      - Bearer: []
    responses:
      204:
        description: About deleted
    """
    about = About.query.first()
    if not about:
        return '', 204
    db.session.delete(about)
    db.session.commit()
    return '', 204
