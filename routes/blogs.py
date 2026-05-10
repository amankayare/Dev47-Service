from flask import Blueprint, request, jsonify
from models import Blog, db, Tag, blog_tags, Comment
from datetime import datetime
from sqlalchemy import func
from utils.security import sanitize_input
from utils.jwt_auth import jwt_required, admin_required
from utils.ai_service_factory import create_ai_service
from schemas import ContentConversionSchema
from marshmallow import ValidationError

blogs_bp = Blueprint('blogs', __name__)


@blogs_bp.route('/convert', methods=['POST'])
@admin_required
def convert_content_to_html():
    """
    Convert raw text or markdown to structured HTML using AI.
    ---
    tags:
      - Blogs
    security:
      - Bearer: []
    parameters:
      - in: body
        name: body
        required: true
        schema:
          type: object
          required: [raw_text]
          properties:
            raw_text:
              type: string
              description: Plain text or markdown content (10-50,000 chars)
    responses:
      200:
        description: Converted HTML with AI-suggested title and excerpt
        schema:
          type: object
          properties:
            html_content:     { type: string }
            suggested_title:  { type: string }
            suggested_excerpt: { type: string }
      400:
        description: Validation error (input too short/long or missing)
      503:
        description: AI service not configured (missing GEMINI_API_KEY)
      502:
        description: AI returned an unparseable response
      500:
        description: Unexpected AI or network failure
    """
    import logging
    logger = logging.getLogger(__name__)

    # --- Step 1: Validate input with Marshmallow ---
    schema = ContentConversionSchema()
    try:
        data = schema.load(request.get_json(force=True) or {})
    except ValidationError as err:
        return jsonify({"errors": err.messages}), 400

    # --- Step 2: Delegate to AI service (Dependency Inversion) ---
    # The route never imports or instantiates Gemini directly.
    try:
        ai_service = create_ai_service()
        custom_prompt = data.get("custom_system_prompt") or None
        result = ai_service.convert_to_html(data["raw_text"], system_prompt=custom_prompt)
    except RuntimeError as exc:
        # GEMINI_API_KEY not configured
        logger.error("AI service not configured: %s", exc)
        return jsonify({"error": str(exc)}), 503
    except ValueError as exc:
        # AI returned malformed/unparseable JSON
        logger.error("AI response parsing error: %s", exc)
        return jsonify({"error": str(exc)}), 502
    except Exception as exc:
        # Network failure, quota exceeded, etc.
        logger.error("AI conversion unexpected error: %s", exc, exc_info=True)
        return jsonify({"error": "AI conversion failed. Please try again."}), 500

    # --- Step 3: Return structured result ---
    return jsonify({
        "html_content":          result.html_content,
        "suggested_title":       result.suggested_title,
        "suggested_excerpt":     result.suggested_excerpt,
        "reading_time_minutes":  result.reading_time_minutes,
    }), 200


@blogs_bp.route('/convert/default-prompt', methods=['GET'])
@admin_required
def get_default_prompt():
    """Return the current server-side default system prompt so the frontend
    can pre-populate the optional prompt editor (admin only)."""
    from utils.gemini_ai_service import _SYSTEM_PROMPT
    return jsonify({"prompt": _SYSTEM_PROMPT}), 200


@blogs_bp.route('/test', methods=['GET'])
def test_endpoint():
    """Test endpoint to verify blueprint is working"""
    return jsonify({"message": "Blogs blueprint is working!"}), 200

@blogs_bp.route('/<int:blog_id>/related', methods=['GET'])
def get_related_blogs(blog_id):
    """
    Get related blogs by shared tags, excluding the current blog, sorted by most recent
    ---
    tags:
      - Blogs
    parameters:
      - in: path
        name: blog_id
        required: true
        schema:
          type: integer
    responses:
      200:
        description: List of related blog posts
        content:
          application/json:
            schema:
              type: array
              items:
                type: object
      404:
        description: Blog not found
    """
    blog = Blog.query.get(blog_id)
    if not blog:
        return jsonify({"error": "Blog not found"}), 404
    tag_ids = [tag.id for tag in blog.tags]
    if not tag_ids:
        # Fallback: return recent blogs excluding current
        related = Blog.query.filter(Blog.id != blog_id).order_by(Blog.date.desc()).limit(5).all()
    else:
        # Find blogs sharing any tag, exclude current
        related = (Blog.query
            .filter(Blog.id != blog_id)
            .filter(Blog.tags.any(Tag.id.in_(tag_ids)))
            .order_by(Blog.date.desc())
            .limit(5)
            .all())
        # If not enough, fill with recent
        if len(related) < 5:
            extra = (Blog.query
                .filter(Blog.id != blog_id)
                .filter(~Blog.tags.any(Tag.id.in_(tag_ids)))
                .order_by(Blog.date.desc())
                .limit(5 - len(related))
                .all())
            related += extra
    return jsonify([b.to_dict() for b in related]), 200


@blogs_bp.route('/', methods=['GET'])
def get_blogs():
    """List all visible blogs
    ---
    tags:
      - Blogs
    responses:
      200:
        description: List of visible blogs
    """
    blogs = Blog.query.filter_by(is_visible=True).order_by(Blog.date.desc()).all()
    return jsonify([b.to_dict() for b in blogs]), 200

@blogs_bp.route('/tags/popular', methods=['GET'])
def get_popular_tags():
    """
    Get most popular tags based on usage frequency across all visible blogs
    ---
    tags:
      - Blogs
    responses:
      200:
        description: List of popular tags with usage statistics
        content:
          application/json:
            schema:
              type: object
              properties:
                popular_tags:
                  type: array
                  items:
                    type: object
                    properties:
                      id:
                        type: integer
                      name:
                        type: string
                      count:
                        type: integer
                      percentage:
                        type: number
                total_blogs:
                  type: integer
      500:
        description: Server error
    """
    try:
        # First check if we have any blogs at all
        total_blogs = Blog.query.filter_by(is_visible=True).count()
        
        if total_blogs == 0:
            # No visible blogs, return empty result
            return jsonify({
                'popular_tags': [],
                'total_blogs': 0
            }), 200
        
        # Query tags with their usage count in visible blogs
        # Use a subquery approach to be more compatible
        popular_tags_query = (db.session.query(
            Tag.id,
            Tag.name,
            func.count(blog_tags.c.blog_id).label('count')
        )
        .join(blog_tags, Tag.id == blog_tags.c.tag_id)
        .join(Blog, blog_tags.c.blog_id == Blog.id)
        .filter(Blog.is_visible == True)  # Only count visible blogs
        .group_by(Tag.id, Tag.name)
        .order_by(func.count(blog_tags.c.blog_id).desc())
        .limit(10))  # Top 10 most popular tags
        
        popular_tags = popular_tags_query.all()
        
        # Format response
        result = {
            'popular_tags': [
                {
                    'id': tag.id,
                    'name': tag.name,
                    'count': tag.count,
                    'percentage': round((tag.count / total_blogs) * 100, 1) if total_blogs > 0 else 0
                }
                for tag in popular_tags
            ],
            'total_blogs': total_blogs
        }
        
        return jsonify(result), 200
        
    except Exception as e:
        # Log the full error for debugging
        import traceback
        error_details = {
            'error': f'Failed to fetch popular tags: {str(e)}',
            'error_type': type(e).__name__,
            'traceback': traceback.format_exc()
        }
        print(f"Popular tags endpoint error: {error_details}")  # Server-side logging
        return jsonify({'error': f'Failed to fetch popular tags: {str(e)}'}), 500

@blogs_bp.route('/tags/popular/simple', methods=['GET'])
def get_popular_tags_simple():
    """
    Simplified popular tags endpoint - fallback version
    """
    try:
        # Simple approach: get all tags and count manually
        from collections import Counter
        
        # Get all visible blogs with their tags
        visible_blogs = Blog.query.filter_by(is_visible=True).all()
        total_blogs = len(visible_blogs)
        
        if total_blogs == 0:
            return jsonify({
                'popular_tags': [],
                'total_blogs': 0
            }), 200
        
        # Count tag usage
        tag_counts = Counter()
        for blog in visible_blogs:
            for tag in blog.tags:
                tag_counts[tag.name] += 1
        
        # Get top 10 tags
        popular_tags = [
            {
                'id': 0,  # Simple version doesn't track IDs
                'name': tag_name,
                'count': count,
                'percentage': round((count / total_blogs) * 100, 1)
            }
            for tag_name, count in tag_counts.most_common(10)
        ]
        
        return jsonify({
            'popular_tags': popular_tags,
            'total_blogs': total_blogs
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Simple popular tags failed: {str(e)}'}), 500

@blogs_bp.route('/admin', methods=['GET'])
@admin_required
def get_all_blogs():
    """List all blogs (including hidden ones) - Admin only with search and pagination
    ---
    tags:
      - Blogs
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
          default: 5
        description: Number of items per page
      - in: query
        name: search
        schema:
          type: string
        description: Search by title, content, summary, or tags
      - in: query
        name: status
        schema:
          type: string
          enum: [all, visible, hidden]
          default: all
        description: Filter by visibility status
    responses:
      200:
        description: Paginated list of all blogs
      403:
        description: Admin access required
    """
    try:
        page = int(request.args.get('page', 1))
        page_size = int(request.args.get('page_size', 5))  # Changed default from 10 to 5
    except ValueError:
        page = 1
        page_size = 5  # Changed default from 10 to 5

    search = request.args.get('search', '').strip()
    status = request.args.get('status', 'all').strip().lower()
    
    query = Blog.query
    
    # Apply search filter
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (Blog.title.ilike(search_pattern)) |
            (Blog.content.ilike(search_pattern)) |
            (Blog.excerpt.ilike(search_pattern))
        )
    
    # Apply status filter
    if status == 'visible':
        query = query.filter(Blog.is_visible == True)
    elif status == 'hidden':
        query = query.filter(Blog.is_visible == False)
    # 'all' shows both visible and hidden blogs (no additional filter)
    
    query = query.order_by(Blog.date.desc())
    total = query.count()
    blogs = query.offset((page - 1) * page_size).limit(page_size).all()
    total_pages = (total + page_size - 1) // page_size
    
    # Get counts for all statuses (for filter badges)
    all_count = Blog.query.count()
    visible_count = Blog.query.filter_by(is_visible=True).count()
    hidden_count = Blog.query.filter_by(is_visible=False).count()

    return jsonify({
        'blogs': [b.to_dict() for b in blogs],
        'total': total,
        'page': page,
        'page_size': page_size,
        'total_pages': total_pages,
        'current_filter': status,
        'counts': {
            'all': all_count,
            'visible': visible_count,
            'hidden': hidden_count
        }
    }), 200

@blogs_bp.route('/<int:blog_id>', methods=['GET'])
def get_blog(blog_id):
    """Get a single blog post by ID
    ---
    tags:
      - Blogs
    parameters:
      - in: path
        name: blog_id
        required: true
        schema:
          type: integer
    responses:
      200:
        description: Blog post details
      404:
        description: Blog not found
    """
    blog = Blog.query.get(blog_id)
    if not blog:
        return jsonify({"error": "Blog not found"}), 404
    return jsonify(blog.to_dict()), 200

@blogs_bp.route('/', methods=['POST'])
@admin_required
def create_blog():
    """Create a new blog
    ---
    tags:
      - Blogs
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
            - content
            - date
            - tags
            - author
          properties:
            title:
              type: string
              description: Blog post title
            excerpt:
              type: string
              description: Short summary
            content:
              type: string
              description: Blog content
            cover_image:
              type: string
              description: Cover image URL
            date:
              type: string
              format: date
              description: Publication date (YYYY-MM-DD)
            reading_time:
              type: integer
              description: Estimated reading time (minutes)
            featured:
              type: boolean
              description: Featured blog flag
            tags:
              type: array
              items:
                type: object
                properties:
                  id:
                    type: integer
                    description: Tag ID
                  name:
                    type: string
                    description: Tag name
              description: List of tag objects
            author:
              type: object
              properties:
                id:
                  type: integer
                  description: Author ID
                name:
                  type: string
                  description: Author name
              description: Author object
    responses:
      201:
        description: Blog created
    """
    try:
        data = request.json
        # Handle tags and author fields
        title = sanitize_input(data.get('title', ''))
        excerpt = sanitize_input(data.get('excerpt', ''))
        # Do NOT sanitize content - store raw HTML
        content = data.get('content', '')
        cover_image = sanitize_input(data.get('cover_image', ''))
        date_str = data.get('date')
        date = None
        if date_str:
            try:
                date = datetime.fromisoformat(date_str)
            except Exception:
                date = None
        reading_time = data.get('reading_time')
        featured = bool(data.get('featured', False))
        # Tags: expects a list of objects (with at least name or id)
        tags = []
        tag_objs = data.get('tags', [])
        if isinstance(tag_objs, list):
            from models import Tag, db
            for tag_obj in tag_objs:
                if isinstance(tag_obj, dict):
                    tag_id = tag_obj.get('id')
                    tag_name = tag_obj.get('name')
                else:
                    tag_id = None
                    tag_name = str(tag_obj)
                tag = None
                if tag_id:
                    tag = Tag.query.get(tag_id)
                if not tag and tag_name:
                    tag = Tag.query.filter_by(name=tag_name).first()
                if not tag and tag_name:
                    tag = Tag(name=tag_name)
                    db.session.add(tag)
                if tag:
                    tags.append(tag)
        # Author: expects an object (with at least name)
        author = None
        author_obj = data.get('author')
        if not author_obj or not isinstance(author_obj, dict) or not author_obj.get('name'):
            return jsonify({'error': 'Author is required and must have a name.'}), 400
        author_id = author_obj.get('id')
        author_name = author_obj.get('name')
        from models import Author, db
        if author_id:
            author = Author.query.get(author_id)
        if not author and author_name:
            author = Author.query.filter_by(name=author_name).first()
        if not author and author_name:
            author = Author(name=author_name)
            db.session.add(author)

        # Handle category (mandatory)
        category_id = data.get('category_id')
        if not category_id:
            return jsonify({'error': 'Category is required.'}), 400
        from models import BlogCategory
        category = BlogCategory.query.get(category_id)
        if not category:
            return jsonify({'error': 'Category not found.'}), 400

        # Handle is_visible flag (default True if not provided)
        is_visible = data.get('is_visible')
        if isinstance(is_visible, str):
            is_visible = is_visible.lower() == 'true'
        else:
            is_visible = bool(is_visible)

        # Handle quick_links (optional)
        quick_links = data.get('quick_links')
        if quick_links and not isinstance(quick_links, list):
            return jsonify({'error': 'quick_links must be an array.'}), 400
        
        from config import Config
        blog = Blog(
            title=title,
            excerpt=sanitize_input(data.get('excerpt', '')),
            content=content,
            cover_image=sanitize_input(data.get('cover_image', '')),
            date=date,
            reading_time=data.get('reading_time'),
            featured=bool(data.get('featured', False)),
            author=author,
            tags=tags,
            is_visible=is_visible,
            category=category,
            quick_links=quick_links
        )
        db.session.add(blog)
        db.session.commit()
        return jsonify(blog.to_dict()), 201
    except Exception as err:
        return jsonify({"errors": str(err)}), 400

@blogs_bp.route('/<int:blog_id>', methods=['PUT'])
@admin_required
def update_blog(blog_id):
    """Update a blog by ID
    ---
    tags:
      - Blogs
    security:
      - Bearer: []
    parameters:
      - in: path
        name: blog_id
        schema:
          type: integer
        required: true
        description: Blog ID
      - in: body
        name: body
        required: true
        schema:
          type: object
          properties:
            title:
              type: string
              description: Blog post title
            content:
              type: string
              description: Blog content
            date:
              type: string
              format: date
              description: Publication date (YYYY-MM-DD)
            tags:
              type: array
              items:
                type: string
              description: List of tags
            author:
              type: string
              description: Author name
    responses:
      200:
        description: Blog updated
      404:
        description: Blog not found
    """
    blog = Blog.query.get(blog_id)
    if not blog:
        return jsonify({"error": "Blog not found"}), 404
    try:
        data = request.json
        from datetime import datetime
        # Handle each field appropriately
        for field in ['title', 'excerpt', 'cover_image']:
            if field in data:
                setattr(blog, field, sanitize_input(data[field]))

        # Handle is_visible
        if 'is_visible' in data:
            val = data['is_visible']
            from config import Config
            import logging
            logger = logging.getLogger(__name__)
            logger.info(f"[DEBUG] Received is_visible: {val} (type: {type(val)})")
            if isinstance(val, str):
                blog.is_visible = val.lower() == 'true'
            else:
                blog.is_visible = bool(val)
            logger.info(f"[DEBUG] Blog {blog_id} is_visible set to: {blog.is_visible}")

        # Handle content separately - do NOT sanitize (store raw HTML)
        if 'content' in data:
            blog.content = data['content']
        if 'reading_time' in data:
            blog.reading_time = data['reading_time']
        if 'featured' in data:
            val = data['featured']
            if isinstance(val, str):
                blog.featured = val.lower() == 'true'
            else:
                blog.featured = bool(val)
        # Handle date
        if 'date' in data:
            date_str = data['date']
            try:
                blog.date = datetime.fromisoformat(date_str)
            except Exception:
                pass
        # Handle tags
        if 'tags' in data:
            tag_names = list(set(data['tags'])) if isinstance(data['tags'], list) else []
            tags = []
            from models import Tag, db
            for tag_name in tag_names:
                tag = Tag.query.filter_by(name=tag_name).first()
                if not tag:
                    tag = Tag(name=tag_name)
                    db.session.add(tag)
                tags.append(tag)
            blog.tags = tags
        # Handle author (expects object with name)
        if 'author' in data:
            author_obj = data['author']
            if not author_obj or not isinstance(author_obj, dict) or not author_obj.get('name'):
                return jsonify({'error': 'Author is required for update and must have a name.'}), 400
            author_id = author_obj.get('id')
            author_name = author_obj.get('name')
            from models import Author, db
            author = None
            if author_id:
                author = Author.query.get(author_id)
            if not author and author_name:
                author = Author.query.filter_by(name=author_name).first()
            if not author and author_name:
                author = Author(name=author_name)
                db.session.add(author)
            blog.author = author
        # Handle category (mandatory)
        if 'category_id' in data:
            from models import BlogCategory
            category_id = data['category_id']
            category = BlogCategory.query.get(category_id)
            if not category:
                return jsonify({'error': 'Category not found.'}), 400
            blog.category = category

        # Handle quick_links (optional)
        if 'quick_links' in data:
            quick_links = data['quick_links']
            if quick_links and not isinstance(quick_links, list):
                return jsonify({'error': 'quick_links must be an array.'}), 400
            blog.quick_links = quick_links

        db.session.commit()
        return jsonify(blog.to_dict()), 200
    except Exception as err:
        return jsonify({"errors": str(err)}), 400

@blogs_bp.route('/<int:blog_id>', methods=['DELETE'])
@jwt_required
def delete_blog(blog_id):
    """Delete a blog by ID
    ---
    tags:
      - Blogs
    security:
      - Bearer: []
    parameters:
      - in: path
        name: blog_id
        schema:
          type: integer
        required: true
        description: Blog ID
    security:
      - Bearer: []
    responses:
      204:
        description: Blog deleted
      404:
        description: Blog not found
      500:
        description: Internal server error
    """
    try:
        blog = Blog.query.get(blog_id)
        if not blog:
            return jsonify({"error": "Blog not found"}), 404
        
        # First delete all comments associated with this blog
        # This includes both direct comments and replies (nested comments)
        Comment.query.filter_by(blog_id=blog_id).delete()
        
        # Now we can safely delete the blog
        db.session.delete(blog)
        db.session.commit()
        return '', 204
        
    except Exception as e:
        db.session.rollback()
        print(f"Error deleting blog {blog_id}: {str(e)}")
        return jsonify({"error": "Failed to delete blog"}), 500
