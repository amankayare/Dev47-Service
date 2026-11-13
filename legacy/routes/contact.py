from flask import Blueprint, request, jsonify
from models import ContactMessage, db
from utils.security import sanitize_input
from utils.jwt_auth import admin_required
from flask_limiter.util import get_remote_address
from flask_limiter import Limiter
import logging

contact_bp = Blueprint('contact', __name__)

@contact_bp.route('/admin/messages', methods=['GET'])
@admin_required
def get_contact_messages():
    """Get all contact messages for admin management (paginated, searchable, filterable, latest first)
    ---
    tags:
      - Contact
    security:
      - Bearer: []
    parameters:
      - in: query
        name: page
        schema:
          type: integer
          default: 1
        description: Page number
      - in: query
        name: page_size
        schema:
          type: integer
          default: 10
        description: Number of items per page
      - in: query
        name: search
        schema:
          type: string
        description: Search by name, email, or subject
      - in: query
        name: status
        schema:
          type: string
          enum: [all, read, unread]
          default: all
        description: Filter by read status
    responses:
      200:
        description: Paginated list of contact messages
      403:
        description: Admin access required
    """
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 10))
    except ValueError:
        page = 1
        page_size = 10

    search = request.args.get('search', '').strip()
    status = request.args.get('status', 'all').strip().lower()
    
    query = ContactMessage.query
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (ContactMessage.name.ilike(search_pattern)) |
            (ContactMessage.email.ilike(search_pattern)) |
            (ContactMessage.subject.ilike(search_pattern))
        )
    
    # Apply status filter
    if status == 'read':
        query = query.filter(ContactMessage.is_read == True)
    elif status == 'unread':
        query = query.filter(ContactMessage.is_read == False)
    # 'all' shows both read and unread messages (no additional filter)
    
    query = query.order_by(ContactMessage.created_at.desc())
    total = query.count()
    messages = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    # Get counts for all statuses (for filter badges)
    all_count = ContactMessage.query.count()
    read_count = ContactMessage.query.filter_by(is_read=True).count()
    unread_count = ContactMessage.query.filter_by(is_read=False).count()

    return jsonify({
        'messages': [m.to_dict() for m in messages],
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'current_filter': status,
        'counts': {
            'all': all_count,
            'read': read_count,
            'unread': unread_count
        }
    }), 200

@contact_bp.route('/admin/messages/<int:message_id>/toggle-read', methods=['PUT'])
@admin_required
def toggle_contact_message_read(message_id):
    """Toggle read status of a contact message (Admin only)
    ---
    tags:
      - Contact
    security:
      - Bearer: []
    parameters:
      - in: path
        name: message_id
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Message read status toggled successfully
        schema:
          type: object
          properties:
            message:
              type: string
            is_read:
              type: boolean
            read_at:
              type: string
              format: date-time
              nullable: true
      404:
        description: Message not found
      403:
        description: Admin access required
    """
    try:
        from datetime import datetime
        message = ContactMessage.query.get_or_404(message_id)
        
        # Toggle the read status
        if message.is_read:
            # Mark as unread
            message.is_read = False
            message.read_at = None
            status_message = 'Contact message marked as unread successfully'
        else:
            # Mark as read
            message.is_read = True
            message.read_at = datetime.utcnow()
            status_message = 'Contact message marked as read successfully'
        
        db.session.commit()
        
        return jsonify({
            'message': status_message,
            'is_read': message.is_read,
            'read_at': message.read_at.isoformat() if message.read_at else None
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to toggle message read status'}), 500

@contact_bp.route('/admin/messages/mark-all-read', methods=['PUT'])
@admin_required
def mark_all_contact_messages_read():
    """Mark all contact messages as read (Admin only)
    ---
    tags:
      - Contact
    security:
      - Bearer: []
    responses:
      200:
        description: All messages marked as read successfully
        schema:
          type: object
          properties:
            message:
              type: string
            updated_count:
              type: integer
      403:
        description: Admin access required
    """
    try:
        from datetime import datetime
        
        # Get count of unread messages before updating
        unread_messages = ContactMessage.query.filter_by(is_read=False).all()
        updated_count = len(unread_messages)
        
        # Update all unread messages to read with timestamp
        current_time = datetime.utcnow()
        for message in unread_messages:
            message.is_read = True
            message.read_at = current_time
        
        db.session.commit()
        return jsonify({
            'message': f'All {updated_count} unread messages marked as read successfully',
            'updated_count': updated_count
        }), 200
        
    except Exception as e:
        return jsonify({'error': 'Failed to mark messages as read'}), 500

@contact_bp.route('/admin/messages/<int:message_id>', methods=['DELETE'])
@admin_required
def delete_contact_message(message_id):
    """Delete a contact message (Admin only)
    ---
    tags:
      - Contact
    security:
      - Bearer: []
    parameters:
      - in: path
        name: message_id
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Message deleted successfully
      404:
        description: Message not found
      403:
        description: Admin access required
    """
    try:
        message = ContactMessage.query.get_or_404(message_id)
        db.session.delete(message)
        db.session.commit()
        return jsonify({'message': 'Contact message deleted successfully'}), 200
    except Exception as e:
        return jsonify({'error': 'Failed to delete message'}), 500


@contact_bp.route('/', methods=['POST'])
def submit_contact():
    """Send a contact message
    ---
    tags:
      - Contact
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required:
            - name
            - email
            - message
          properties:
            name:
              type: string
              description: Sender's name
            email:
              type: string
              description: Sender's email
            subject:
              type: string
              description: Subject
            message:
              type: string
              description: Message body
            phone:
              type: string
              description: Sender's phone number
            preferred_contact_method:
              type: string
              description: Preferred contact method (email/phone/other)
    security: []  # Explicitly mark this endpoint as public in Swagger
    responses:
      201:
        description: Message sent
      400:
        description: Validation error
    """
    data = request.json
    # Sanitize input to prevent XSS
    name = sanitize_input(data.get('name', ''))
    email = sanitize_input(data.get('email', ''))
    subject = sanitize_input(data.get('subject', ''))
    message = sanitize_input(data.get('message', ''))
    phone = sanitize_input(data.get('phone', ''))
    preferred_contact_method = sanitize_input(data.get('preferred_contact_method', ''))

    contact = ContactMessage(
        name=name,
        email=email,
        subject=subject,
        message=message,
        phone=phone,
        preferred_contact_method=preferred_contact_method
    )
    db.session.add(contact)
    db.session.commit()
    return jsonify(contact.to_dict()), 201
