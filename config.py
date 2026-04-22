import os

class Config:
    # Environment detection
    ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
    
    # Configuration properties (unchanged for backward compatibility)
    SECRET_KEY = os.environ.get("SECRET_KEY", "your-secret-key")
    # Use absolute path for database in instance folder (convert backslashes to forward slashes for SQLite URI)
    BASE_DIR = os.path.abspath(os.path.dirname(__file__))
    INSTANCE_DIR = os.path.join(BASE_DIR, 'instance')
    os.makedirs(INSTANCE_DIR, exist_ok=True)
    DB_PATH = os.path.join(INSTANCE_DIR, 'portfolio.db').replace('\\', '/')
    SQLALCHEMY_DATABASE_URI = os.environ.get("DATABASE_URL", f"sqlite:///{DB_PATH}")
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    FRONTEND_ORIGIN = os.environ.get("FRONTEND_ORIGIN", "http://localhost:3001")  # Vite dev server
    RESUME_PATH = os.environ.get("RESUME_PATH", "../../assets/Aman Resume.pdf")
    ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "changeme")  # Legacy, not used with JWT
    JWT_SECRET = os.environ.get("JWT_SECRET", "changeme-jwt")
    JWT_EXP_MINUTES = int(os.environ.get("JWT_EXP_MINUTES", 60))
    
    # Point 1: Missing Production Settings
    # CORS Configuration - Allow both dev (3001) and prod (5000) origins
    CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:3001,http://localhost:5000,http://localhost:3000")
    
    # Rate Limiting Configuration
    RATELIMIT_STORAGE_URL = os.environ.get("RATELIMIT_STORAGE_URL", "memory://")
    DEFAULT_RATE_LIMIT = os.environ.get("DEFAULT_RATE_LIMIT", "1000 per hour")
    AUTH_RATE_LIMIT = os.environ.get("AUTH_RATE_LIMIT", "10 per minute")
    
    # Logging Configuration
    LOG_LEVEL = os.environ.get("LOG_LEVEL", "DEBUG" if ENVIRONMENT == "development" else "INFO")
    LOG_FILE = os.environ.get("LOG_FILE", None)  # None = console only
    
    # File Upload Configuration
    MAX_CONTENT_LENGTH = int(os.environ.get("MAX_CONTENT_LENGTH", 16 * 1024 * 1024))  # 16MB
    UPLOAD_FOLDER = os.environ.get("UPLOAD_FOLDER", "uploads")
    
    # Point 4: Production Optimizations
    # Database Configuration
    SQLALCHEMY_ENGINE_OPTIONS = {
        'pool_size': int(os.environ.get("DB_POOL_SIZE", 5)),
        'pool_timeout': int(os.environ.get("DB_POOL_TIMEOUT", 30)),
        'pool_recycle': int(os.environ.get("DB_POOL_RECYCLE", 3600)),
        'max_overflow': int(os.environ.get("DB_MAX_OVERFLOW", 10))
    }
    
    # Performance Settings
    THREADED = os.environ.get("THREADED", "true").lower() == "true"
    DEBUG = os.environ.get("DEBUG", "true" if ENVIRONMENT == "development" else "false").lower() == "true"
    
    # Point 7: Health Check Configuration
    HEALTH_CHECK_DATABASE = os.environ.get("HEALTH_CHECK_DATABASE", "true").lower() == "true"
    HEALTH_CHECK_TIMEOUT = int(os.environ.get("HEALTH_CHECK_TIMEOUT", 5))  # seconds
    
    @classmethod
    def is_production(cls):
        """Check if running in production environment"""
        return cls.ENVIRONMENT.lower() == "production"
    
    @classmethod
    def _is_default_value(cls, actual_value, default_value):
        """Reusable helper to check if a value is using its default"""
        return actual_value == default_value
    
    @classmethod
    def validate_production_config(cls):
        """Validate that production environment has secure configuration"""
        if not cls.is_production():
            return  # Skip validation for development
        
        errors = []
        
        # Check for insecure secret keys
        if cls._is_default_value(cls.SECRET_KEY, "your-secret-key"):
            errors.append("SECRET_KEY must be set to a secure value in production")
        
        if cls._is_default_value(cls.JWT_SECRET, "changeme-jwt"):
            errors.append("JWT_SECRET must be set to a secure value in production")
        
        # Check for default admin credentials
        if cls._is_default_value(cls.ADMIN_USERNAME, "admin"):
            errors.append("ADMIN_USERNAME must be changed from default in production")
        
        
        # Point 1 & 4: Additional Production Validations
        if cls.DEBUG:
            errors.append("DEBUG must be disabled in production (set DEBUG=false)")
        
        # Validate critical paths exist
        if cls.RESUME_PATH and not os.path.exists(cls.RESUME_PATH):
            errors.append(f"RESUME_PATH does not exist: {cls.RESUME_PATH}")
        
        if errors:
            error_message = "Production configuration validation failed:\n" + "\n".join(f"- {error}" for error in errors)
            raise ValueError(error_message)
    
    @classmethod
    def validate_health_check(cls):
        """Point 7: Validate system health and connectivity"""
        health_issues = []
        
        if cls.HEALTH_CHECK_DATABASE:
            try:
                # Test database connectivity
                from sqlalchemy import create_engine, text
                engine = create_engine(cls.SQLALCHEMY_DATABASE_URI, **cls.SQLALCHEMY_ENGINE_OPTIONS)
                with engine.connect() as conn:
                    conn.execute(text("SELECT 1"))
                    conn.close()
                engine.dispose()
            except Exception as e:
                health_issues.append(f"Database connectivity failed: {str(e)}")
        
        # Check upload directory
        try:
            upload_path = os.path.abspath(cls.UPLOAD_FOLDER)
            if not os.path.exists(upload_path):
                os.makedirs(upload_path, exist_ok=True)
        except Exception as e:
            health_issues.append(f"Upload directory issue: {str(e)}")
        
        return health_issues
    
    @classmethod
    def get_config_summary(cls):
        """Point 5: Get sanitized configuration summary for debugging"""
        summary = {
            "environment": cls.ENVIRONMENT,
            "debug_mode": cls.DEBUG,
            "database_type": "sqlite" if "sqlite" in cls.SQLALCHEMY_DATABASE_URI.lower() else "postgresql",
            "frontend_origin": cls.FRONTEND_ORIGIN,
            "cors_origins": cls.CORS_ORIGINS,
            "rate_limiting": {
                "default": cls.DEFAULT_RATE_LIMIT,
                "auth": cls.AUTH_RATE_LIMIT,
                "storage": cls.RATELIMIT_STORAGE_URL
            },
            "logging": {
                "level": cls.LOG_LEVEL,
                "file": cls.LOG_FILE or "console"
            },
            "uploads": {
                "max_size": f"{cls.MAX_CONTENT_LENGTH / (1024*1024):.1f}MB",
                "folder": cls.UPLOAD_FOLDER
            },
            "database_pool": cls.SQLALCHEMY_ENGINE_OPTIONS,
            "health_checks": {
                "database": cls.HEALTH_CHECK_DATABASE,
                "timeout": cls.HEALTH_CHECK_TIMEOUT
            },
            "security": {
                "jwt_expiry": f"{cls.JWT_EXP_MINUTES} minutes",
                "secrets_configured": {
                    "SECRET_KEY": not cls._is_default_value(cls.SECRET_KEY, "your-secret-key"),
                    "JWT_SECRET": not cls._is_default_value(cls.JWT_SECRET, "changeme-jwt"),
                }
            }
        }
        return summary
    
    @classmethod
    def get_environment_report(cls):
        """Point 5: Generate environment validation report"""
        report = {
            "environment": cls.ENVIRONMENT,
            "production_ready": cls.is_production(),
            "using_defaults": [],
            "recommendations": []
        }
        
        # Check for default values
        defaults_check = [
            ("SECRET_KEY", cls.SECRET_KEY, "your-secret-key"),
            ("JWT_SECRET", cls.JWT_SECRET, "changeme-jwt"),
            ("ADMIN_USERNAME", cls.ADMIN_USERNAME, "admin"),
        ]
        
        for name, value, default in defaults_check:
            if cls._is_default_value(value, default):
                report["using_defaults"].append(name)
        
        # Generate recommendations
        if report["using_defaults"]:
            report["recommendations"].append("Change default security values before deploying to production")
        
        if cls.is_production() and cls.DEBUG:
            report["recommendations"].append("Disable DEBUG mode in production")
        
        # if "sqlite" in cls.SQLALCHEMY_DATABASE_URI.lower() and cls.is_production():
        #     report["recommendations"].append("Consider using PostgreSQL for production database")
        
        return report
    
    @classmethod
    def init_config(cls):
        """Initialize and validate configuration. Call this during app startup."""
        # Validate production configuration
        cls.validate_production_config()
        
        # Point 5: Log configuration summary in development
        if not cls.is_production():
            import logging
            logging.basicConfig(level=getattr(logging, cls.LOG_LEVEL.upper()))
            logger = logging.getLogger(__name__)
            logger.info("=== Configuration Summary ===")
            summary = cls.get_config_summary()
            for key, value in summary.items():
                logger.info(f"{key}: {value}")
        
        # Point 7: Run health checks
        health_issues = cls.validate_health_check()
        if health_issues:
            import logging
            logger = logging.getLogger(__name__)
            logger.warning("Health check issues found:")
            for issue in health_issues:
                logger.warning(f"- {issue}")
            
            # In production, fail fast on critical health issues
            if cls.is_production() and any("Database connectivity failed" in issue for issue in health_issues):
                raise RuntimeError("Critical health check failed: Database connectivity required in production")
        
        return cls
