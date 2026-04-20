from marshmallow import Schema, fields, validate

# --- User Schemas ---
class UserRegistrationSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3, max=80))
    email = fields.Email(required=True)
    password = fields.Str(required=True, validate=validate.Length(min=6))

class UserLoginSchema(Schema):
    username = fields.Str(required=True)  # Can be username or email
    password = fields.Str(required=True)

class ChangePasswordSchema(Schema):
    currentPassword = fields.Str(required=True, validate=validate.Length(min=1))
    newPassword = fields.Str(required=True, validate=validate.Length(min=8))

class UserProfileUpdateSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3, max=80))
    email = fields.Email(required=True)

# --- Contact Message Schema ---
class ContactMessageSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=120))
    email = fields.Email(required=True)
    subject = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    message = fields.Str(required=True, validate=validate.Length(min=10))
    phone = fields.Str(validate=validate.Length(max=50))
    preferred_contact_method = fields.Str(validate=validate.Length(max=50))

# --- Project Schema ---
class ProjectSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    description = fields.Str(required=True)
    tech = fields.List(fields.Str())
    links = fields.List(fields.Dict())
    image = fields.Str(validate=validate.Length(max=300))
    gallery = fields.List(fields.Str())
    project_type = fields.Str(validate=validate.Length(max=100))
    start_date = fields.Date()
    end_date = fields.Date(allow_none=True)
    role = fields.Str(validate=validate.Length(max=100))
    team_size = fields.Int()
    categories = fields.List(fields.Str())
    is_visible = fields.Bool()
    order = fields.Int()

# --- Blog Schema ---
class BlogSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    excerpt = fields.Str(validate=validate.Length(max=500))
    content = fields.Str(required=True)
    cover_image = fields.Str(validate=validate.Length(max=300))
    reading_time = fields.Int()
    featured = fields.Bool()
    author_id = fields.Int()
    tag_ids = fields.List(fields.Int())
    category_id = fields.Int(required=True)

# --- Blog Category Schema ---
class BlogCategorySchema(Schema):
    id = fields.Int(dump_only=True)
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))

# --- Certification Schema ---
class CertificationSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    issuer = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    date = fields.Str(validate=validate.Length(max=100))
    credential_url = fields.Str(validate=validate.Length(max=300))
    description = fields.Str()
    skills = fields.List(fields.Str())
    certificate_id = fields.Str(validate=validate.Length(max=100))
    expiration_date = fields.Date()

# --- About Schema ---
class AboutSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    headline = fields.Str(validate=validate.Length(max=200))
    bio = fields.Str(required=True)
    photo = fields.Str(validate=validate.Length(max=300))
    cover_image = fields.Str(validate=validate.Length(max=300))
    location = fields.Str(validate=validate.Length(max=200))
    email = fields.Email()
    phone = fields.Str(validate=validate.Length(max=50))
    resume_url = fields.Str(validate=validate.Length(max=300))
    social_links = fields.Dict()

# --- Tag Schema ---
class TagSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=50))

# --- Author Schema ---
class AuthorSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1, max=100))
    email = fields.Email()

# --- Technical Skills Schema ---
class TechnicalSkillSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    skills = fields.List(fields.Str())
    color = fields.Str(validate=validate.Length(max=100))
    icon = fields.Str(validate=validate.Length(max=50))
    order = fields.Int()
    is_visible = fields.Bool()

# --- Experience Schema ---
class ExperienceSchema(Schema):
    title = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    company = fields.Str(required=True, validate=validate.Length(min=1, max=200))
    location = fields.Str(validate=validate.Length(max=200))
    start_date = fields.Date()
    end_date = fields.Date(allow_none=True)
    is_current = fields.Bool()
    duration = fields.Str(validate=validate.Length(max=100))
    responsibilities = fields.List(fields.Str())
    achievements = fields.List(fields.Str())
    technologies = fields.List(fields.Str())
    color = fields.Str(validate=validate.Length(max=100))
    order = fields.Int()
    is_visible = fields.Bool()

# --- Comment Schema ---
class CommentSchema(Schema):
    content = fields.Str(required=True, validate=validate.Length(min=1, max=2000))
    parent_id = fields.Int(allow_none=True)