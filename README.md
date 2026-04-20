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
- Python 3.8+
- pip

### Installation
```bash
pip install -r requirements.txt
```

### Development Server
```bash
python app.py
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
DATABASE_URL=sqlite:///portfolio.db
JWT_SECRET_KEY=your-super-secret-jwt-key-here
FRONTEND_ORIGIN=http://localhost:3000
```

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
- Uses SQLite by default
- Database file: `portfolio.db`

### Production
- Recommended: PostgreSQL
- Set `DATABASE_URL` environment variable

## Authentication

The API uses JWT tokens for authentication:
- Login: `POST /api/auth/login`
- Register: `POST /api/auth/register`
- Protected routes require `Authorization: Bearer <token>` header

## Deployment

### Traditional Hosting
1. Install dependencies: `pip install -r requirements.txt`
2. Set environment variables
3. Initialize database: `python init_db.py`
4. Run with gunicorn: `gunicorn -w 4 -b 0.0.0.0:5000 app:app`

### Docker
Use the Dockerfile in the `../docker/` directory.

### Cloud Platforms
- **Heroku**: Use `Procfile`
- **AWS Elastic Beanstalk**: Deploy as Python application
- **Google Cloud Run**: Use Docker deployment
