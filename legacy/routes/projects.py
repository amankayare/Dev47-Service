from flask import Blueprint, request, jsonify
from models import Project, db


from utils.security import sanitize_input
from utils.jwt_auth import jwt_required, admin_required

projects_bp = Blueprint('projects', __name__)


@projects_bp.route('/', methods=['GET'])
def get_projects():
    """List all visible projects
    ---
    tags:
      - Projects
    responses:
      200:
        description: List of visible projects
    """
    projects = Project.query.filter_by(is_visible=True).order_by(Project.order.asc()).all()
    return jsonify([p.to_dict() for p in projects]), 200

@projects_bp.route('/featured', methods=['GET'])
def get_featured_projects():
    """List all visible featured projects
    ---
    tags:
      - Projects
    responses:
      200:
        description: List of visible featured projects
    """
    projects = Project.query.filter_by(is_visible=True, is_featured=True).order_by(Project.order.asc()).all()
    return jsonify([p.to_dict() for p in projects]), 200

@projects_bp.route('/admin', methods=['GET'])
@admin_required
def get_all_projects():
    """List all projects (including hidden ones) - Admin only
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    responses:
      200:
        description: List of all projects
      403:
        description: Admin access required
    """
    projects = Project.query.order_by(Project.order.asc()).all()
    return jsonify([p.to_dict() for p in projects]), 200

@projects_bp.route('/', methods=['POST'])
@admin_required
def create_project():
    """Create a new project
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - title
            - description
            - links
            - github_url
            - live_url
            - order
          properties:
            title:
              type: string
              description: Project title
            description:
              type: string
              description: Project description
            tech_stack:
              type: array
              items:
                type: string
              description: List of technologies used
            github_url:
              type: string
              description: GitHub repository URL
            live_url:
              type: string
              description: Live project URL
            order:
              type: integer
              description: Display order
            links:
              type: array
              items:
                type: object
                properties:
                  name:
                    type: string
                    description: Link name
                  url:
                    type: string
                    description: Link URL
              description: List of project links (e.g., GitHub, Live Demo)
            image:
              type: string
              description: Project image URL
            gallery:
              type: array
              items:
                type: string
              description: List of gallery image/video URLs
            project_type:
              type: string
              description: Project type (e.g., Personal, Client)
            start_date:
              type: string
              format: date
              description: Start date (YYYY-MM-DD)
            end_date:
              type: string
              format: date
              description: End date (YYYY-MM-DD)
            role:
              type: string
              description: Your role in the project
            team_size:
              type: integer
              description: Team size
            categories:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Category ID
                  name:
                    type: string
                    description: Category name
              description: List of category objects
            is_visible:
              type: boolean
              description: Visibility flag
    responses:
      201:
        description: Project created
    """
    try:
        data = request.json
        from datetime import datetime
        # Parse categories as array of objects (with at least name/id)
        categories_objs = data.get('categories', [])
        categories = []
        if isinstance(categories_objs, list):
            for cat in categories_objs:
                if isinstance(cat, dict):
                    categories.append(cat.get('name') or cat.get('id'))
                else:
                    categories.append(cat)
        # Parse links as array of objects (with at least name/url)
        links_objs = data.get('links', [])
        links = []
        if isinstance(links_objs, list):
            for link in links_objs:
                if isinstance(link, dict):
                    links.append({'name': link.get('name'), 'url': link.get('url')})
                else:
                    links.append({'name': str(link), 'url': ''})
        project = Project(
            title=sanitize_input(data['title']),
            description=sanitize_input(data['description']),
            tech=data.get('tech_stack', []),
            links=links,
            image=sanitize_input(data.get('image', '')),
            gallery=data.get('gallery', []),
            project_type=sanitize_input(data.get('project_type', '')),
            start_date=datetime.fromisoformat(data['start_date']) if data.get('start_date') else None,
            end_date=datetime.fromisoformat(data['end_date']) if data.get('end_date') else None,
            role=sanitize_input(data.get('role', '')),
            team_size=data.get('team_size'),
            categories=categories,
            is_visible=data.get('is_visible', True),
            is_featured=data.get('is_featured', False),
            order=data.get('order', 0),
        )
        db.session.add(project)
        db.session.commit()
        return jsonify(project.to_dict()), 201
    except Exception as err:
        return jsonify({"errors": err}), 400

@projects_bp.route('/<int:project_id>', methods=['PUT'])
@jwt_required
def update_project(project_id):
    """Update a project by ID
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        schema:
          type: integer
        required: true
        description: Project ID
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - title
            - description
            - tech_stack
            - github_url
            - live_url
            - order
          properties:
            title:
              type: string
              description: Project title
            description:
              type: string
              description: Project description
            tech_stack:
              type: array
              items:
                type: string
              description: List of technologies used
            github_url:
              type: string
              description: GitHub repository URL
            live_url:
              type: string
              description: Live project URL
            order:
              type: integer
              description: Display order
    responses:
      200:
        description: Project updated
      404:
        description: Project not found
    """
    try:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"error": "Project not found"}), 404
        data = request.json
        from datetime import datetime
        for field in ['title', 'description', 'image', 'project_type', 'role']:
            if field in data:
                setattr(project, field, sanitize_input(data[field]))
        if 'tech' in data:
            project.tech = data['tech']
        # Parse links as array of objects (with at least name/url)
        if 'links' in data:
            links_objs = data['links']
            links = []
            if isinstance(links_objs, list):
                for link in links_objs:
                    if isinstance(link, dict):
                        links.append({'name': link.get('name'), 'url': link.get('url')})
                    else:
                        links.append({'name': str(link), 'url': ''})
            project.links = links
        if 'gallery' in data:
            project.gallery = data['gallery']
        # Parse categories as array of objects (with at least name/id)
        if 'categories' in data:
            categories_objs = data['categories']
            categories = []
            if isinstance(categories_objs, list):
                for cat in categories_objs:
                    if isinstance(cat, dict):
                        categories.append(cat.get('name') or cat.get('id'))
                    else:
                        categories.append(cat)
            project.categories = categories
        if 'team_size' in data:
            project.team_size = data['team_size']
        if 'is_visible' in data:
            project.is_visible = bool(data['is_visible'])
        if 'is_featured' in data:
            project.is_featured = bool(data['is_featured'])
        if 'order' in data:
            project.order = data['order']
        if 'start_date' in data:
            project.start_date = datetime.fromisoformat(data['start_date']) if data['start_date'] else None
        if 'end_date' in data:
            project.end_date = datetime.fromisoformat(data['end_date']) if data['end_date'] else None
        db.session.commit()
        return jsonify(project.to_dict()), 200
    except Exception as err:
        return jsonify({"errors": err}), 400

@projects_bp.route('/<int:project_id>', methods=['DELETE'])
@jwt_required
@admin_required
def delete_project(project_id):
    """Delete a project by ID
    ---
    tags:
      - Projects
    security:
      - Bearer: []
    parameters:
      - in: path
        name: project_id
        schema:
          type: integer
        required: true
        description: Project ID
    security:
      - Bearer: []
    responses:
      204:
        description: Project deleted
      404:
        description: Project not found
    """
    project = Project.query.get(project_id)
    if not project:
        return jsonify({"error": "Project not found"}), 404
    db.session.delete(project)
    db.session.commit()
    return '', 204
