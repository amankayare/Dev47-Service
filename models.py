from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.dialects.sqlite import JSON as SQLiteJSON
from sqlalchemy.dialects.postgresql import JSONB
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
import os

db = SQLAlchemy()

# --- Users ---
class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    
    def set_password(self, password):
        self.password_hash = generate_password_hash(password)
    
    def check_password(self, password):
        return check_password_hash(self.password_hash, password)
    
    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'is_admin': self.is_admin,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'last_login': self.last_login.isoformat() if self.last_login else None
        }

class ContactMessage(db.Model):
    __tablename__ = 'contact_messages'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    subject = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    phone = db.Column(db.String(50), nullable=True)
    preferred_contact_method = db.Column(db.String(50), nullable=True)
    is_read = db.Column(db.Boolean, default=False, nullable=False)
    read_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'subject': self.subject,
            'message': self.message,
            'phone': self.phone,
            'preferred_contact_method': self.preferred_contact_method,
            'is_read': self.is_read,
            'read_at': self.read_at.isoformat() if self.read_at else None,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# --- Projects ---
class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    description = db.Column(db.Text, nullable=False)
    tech = db.Column(db.JSON, nullable=True)  # list of techs
    links = db.Column(db.JSON, nullable=True)  # list of {name, url}
    image = db.Column(db.String(300), nullable=True)
    gallery = db.Column(db.JSON, nullable=True)  # list of image/video URLs
    project_type = db.Column(db.String(100), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    role = db.Column(db.String(100), nullable=True)
    team_size = db.Column(db.Integer, nullable=True)
    categories = db.Column(db.JSON, nullable=True)  # list of strings
    is_visible = db.Column(db.Boolean, default=True)
    is_featured = db.Column(db.Boolean, default=False)
    order = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'tech': self.tech,
            'links': self.links,
            'image': self.image,
            'gallery': self.gallery,
            'project_type': self.project_type,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'role': self.role,
            'team_size': self.team_size,
            'categories': self.categories,
            'is_visible': self.is_visible,
            'is_featured': self.is_featured,
            'order': self.order,
            'created_at': self.created_at.isoformat() if self.created_at else None
        }

# --- Blogs ---
blog_tags = db.Table('blog_tags',
    db.Column('blog_id', db.Integer, db.ForeignKey('blogs.id'), primary_key=True),
    db.Column('tag_id', db.Integer, db.ForeignKey('tags.id'), primary_key=True)
)

# --- Blog Category ---
class BlogCategory(db.Model):
    __tablename__ = 'blog_categories'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Tag(db.Model):
    __tablename__ = 'tags'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(50), unique=True, nullable=False)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name
        }

class Author(db.Model):
    __tablename__ = 'authors'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(120), nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email
        }

class Blog(db.Model):
    __tablename__ = 'blogs'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    excerpt = db.Column(db.String(500), nullable=True)
    content = db.Column(db.Text, nullable=False)
    cover_image = db.Column(db.String(300), nullable=True)
    date = db.Column(db.DateTime, default=datetime.utcnow)
    reading_time = db.Column(db.Integer, nullable=True)
    featured = db.Column(db.Boolean, default=False)
    is_visible = db.Column(db.Boolean, default=True)  # <-- Added for filtering
    quick_links = db.Column(db.JSON, nullable=True)  # <-- Added for dynamic quick links
    category_id = db.Column(db.Integer, db.ForeignKey('blog_categories.id'), nullable=False)
    category = db.relationship('BlogCategory', backref=db.backref('blogs', lazy=True))
    author_id = db.Column(db.Integer, db.ForeignKey('authors.id'), nullable=True)
    author = db.relationship('Author', backref=db.backref('blogs', lazy=True))
    tags = db.relationship('Tag', secondary=blog_tags, lazy='subquery',
        backref=db.backref('blogs', lazy=True))
    # Add cascade delete relationship for comments
    comments = db.relationship('Comment', cascade='all, delete-orphan', passive_deletes=True)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'excerpt': self.excerpt,
            'content': self.content,
            'cover_image': self.cover_image,
            'date': self.date.isoformat() if self.date else None,
            'reading_time': self.reading_time,
            'featured': self.featured,
            'is_visible': self.is_visible,
            'quick_links': self.quick_links,
            'category_id': self.category_id,
            'category': self.category.to_dict() if self.category else None,
            'author_id': self.author_id,
            'author': self.author.to_dict() if self.author else None,
            'tags': [tag.to_dict() for tag in self.tags]
        }

# --- Certifications ---
class Certification(db.Model):
    __tablename__ = 'certifications'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(200), nullable=False)
    issuer = db.Column(db.String(200), nullable=False)
    date = db.Column(db.String(100), nullable=True)
    credential_url = db.Column(db.String(300), nullable=True)
    description = db.Column(db.Text, nullable=True)
    skills = db.Column(db.JSON, nullable=True)  # list of strings
    certificate_id = db.Column(db.String(100), nullable=True)
    expiration_date = db.Column(db.Date, nullable=True)
    is_visible = db.Column(db.Boolean, default=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'issuer': self.issuer,
            'date': self.date,
            'credential_url': self.credential_url,
            'description': self.description,
            'skills': self.skills,
            'certificate_id': self.certificate_id,
            'expiration_date': self.expiration_date.isoformat() if self.expiration_date else None,
            'is_visible': self.is_visible
        }

# --- About ---
class About(db.Model):
    __tablename__ = 'about'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    headline = db.Column(db.String(200), nullable=True)
    bio = db.Column(db.Text, nullable=False)
    photo = db.Column(db.String(300), nullable=True)
    cover_image = db.Column(db.String(300), nullable=True)
    location = db.Column(db.String(200), nullable=True)
    email = db.Column(db.String(120), nullable=True)
    phone = db.Column(db.String(50), nullable=True)
    resume_url = db.Column(db.String(300), nullable=True)
    social_links = db.Column(db.JSON, nullable=True)

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'headline': self.headline,
            'bio': self.bio,
            'photo': self.photo,
            'cover_image': self.cover_image,
            'location': self.location,
            'email': self.email,
            'phone': self.phone,
            'resume_url': self.resume_url,
            'social_links': self.social_links
        }

# --- Technical Skills ---
class TechnicalSkill(db.Model):
    __tablename__ = 'technical_skills'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    skills = db.Column(db.JSON, nullable=True)  # list of skill strings
    color = db.Column(db.String(100), nullable=True)  # gradient color
    icon = db.Column(db.String(50), nullable=True)  # icon name
    order = db.Column(db.Integer, default=0)
    is_visible = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'skills': self.skills,
            'color': self.color,
            'icon': self.icon,
            'order': self.order,
            'is_visible': self.is_visible
        }

# --- Experience ---
class Experience(db.Model):
    __tablename__ = 'experiences'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(200), nullable=False)
    company = db.Column(db.String(200), nullable=False)
    location = db.Column(db.String(200), nullable=True)
    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)
    is_current = db.Column(db.Boolean, default=False)
    duration = db.Column(db.String(100), nullable=True)
    responsibilities = db.Column(db.JSON, nullable=True)  # list of strings
    achievements = db.Column(db.JSON, nullable=True)  # list of strings
    technologies = db.Column(db.JSON, nullable=True)  # list of strings
    color = db.Column(db.String(100), nullable=True)  # gradient color
    order = db.Column(db.Integer, default=0)
    is_visible = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'company': self.company,
            'location': self.location,
            'start_date': self.start_date.isoformat() if self.start_date else None,
            'end_date': self.end_date.isoformat() if self.end_date else None,
            'is_current': self.is_current,
            'period': f"{self.start_date.strftime('%m/%Y') if self.start_date else ''} - {'Present' if self.is_current else self.end_date.strftime('%m/%Y') if self.end_date else ''}",
            'duration': self.duration,
            'responsibilities': self.responsibilities,
            'achievements': self.achievements,
            'color': self.color,
            'order': self.order,
            'is_visible': self.is_visible
        }

# --- Comments ---
class Comment(db.Model):
    __tablename__ = 'comments'
    id = db.Column(db.Integer, primary_key=True)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Foreign Keys
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    blog_id = db.Column(db.Integer, db.ForeignKey('blogs.id', ondelete='CASCADE'), nullable=False)
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    # Relationships
    author = db.relationship('User', backref=db.backref('comments', lazy=True))
    blog = db.relationship('Blog')
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='select')
    
    def to_dict(self):
        return {
            'id': self.id,
            'content': self.content,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'author_id': self.author_id,
            'blog_id': self.blog_id,
            'parent_id': self.parent_id,
            'author': self.author.to_dict() if self.author else None
        }
