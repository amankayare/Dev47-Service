# Visual Portfolio - Backend

Flask-based REST API backend with SQLAlchemy and JWT authentication.

## Tech Stack

- **Framework:** Flask
- **Database:** SQLAlchemy (SQLite/PostgreSQL)
- **Authentication:** JWT
- **Documentation:** Swagger/Flasgger
- **CORS:** Flask-CORS

## Development

### Prerequisites
- Python 3.9+
- [uv](https://docs.astral.sh/uv/getting-started/installation/)

### Installation
```bash
uv sync
```

### Development Server
```bash
uv run python app.py
```

The API will be available at http://localhost:5000

### Database Setup
```bash
python init_db.py
```

### Environment Variables

Create a `.env` file in this directory:

```env
FLASK_ENV=development
DATABASE_BACKEND=sqlalchemy
DATABASE_URL=sqlite:///portfolio.db
JWT_SECRET_KEY=your-super-secret-jwt-key-here
FRONTEND_ORIGIN=http://localhost:3000
```

### Cloudflare D1 HTTP API

The database provider interface can be selected with `DATABASE_BACKEND`:

- `sqlalchemy` (default): uses `DATABASE_URL` and the existing SQLAlchemy models.
- `cloudflare_d1`: uses Cloudflare's D1 query HTTP API. Configure
  `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_D1_DATABASE_ID`, and
  `CLOUDFLARE_API_TOKEN`; optionally set `CLOUDFLARE_D1_TIMEOUT` (seconds).
  Use a scoped API token with D1 query permissions and keep it out of source
  control.

The provider is available as `app.extensions["database_provider"]` and
supports parameterized `execute(sql, params)` calls. D1 uses positional
parameters (`?` placeholders), for example:

```python
result = app.extensions["database_provider"].execute(
    "SELECT id, title FROM projects WHERE id = ?", [project_id]
)
```

**Current limitation:** Existing API routes and model-based scripts directly
use SQLAlchemy ORM sessions. Selecting `cloudflare_d1` configures the D1
provider and its health check, but does not yet move those existing ORM
operations to D1. Keep `DATABASE_BACKEND=sqlalchemy` until those data access
paths are migrated to the provider interface.

## Project Structure

```
├── app.py              # Main Flask application
├── config.py           # Configuration settings
├── models.py           # Database models
├── schemas.py          # Data serialization schemas
├── init_db.py          # Database initialization
├── routes/             # API endpoints
│   ├── auth.py         # Authentication endpoints
│   ├── projects.py     # Projects management
│   ├── blogs.py        # Blog posts
│   └── ...
├── utils/              # Utility functions
├── uploads/            # File uploads directory
└── instance/           # Instance-specific files
```

## API Documentation

When running in development mode, Swagger documentation is available at:
- http://localhost:5000/apidocs/

## Database

### Development
- Uses SQLAlchemy with SQLite by default
- Database file: `portfolio.db`

### Production
- SQLAlchemy can use PostgreSQL
- Set `DATABASE_URL` environment variable
- Cloudflare D1 is available through the separate HTTP provider described above.

## Authentication

The API uses JWT tokens for authentication:
- Login: `POST /api/auth/login`
- Register: `POST /api/auth/register`
- Protected routes require `Authorization: Bearer <token>` header

## Deployment

### Traditional Hosting
1. Install dependencies: `uv sync`
2. Set environment variables
3. Initialize database: `uv run python init_db.py`
4. Run with gunicorn: `uv run gunicorn -w 4 -b 0.0.0.0:5000 app:app`

### Docker
Use the Dockerfile in the `../docker/` directory.

### Cloud Platforms
- **Heroku**: Use `Procfile`
- **AWS Elastic Beanstalk**: Deploy as Python application
- **Google Cloud Run**: Use Docker deployment
