import os
import sys
import traceback

print("=== FLASK SERVER STARTUP DEBUG ===")
print(f"Python version: {sys.version}")
print(f"Current directory: {os.getcwd()}")
print(f"Python path: {sys.path[:3]}...")

try:
    print("\n1. Testing basic imports...")
    from flask import Flask
    print("✓ Flask imported")
    
    from flask_cors import CORS
    print("✓ Flask-CORS imported")
    
    print("\n2. Testing config import...")
    from config import Config
    print("✓ Config imported")
    
    print("\n3. Creating Flask app...")
    app = Flask(__name__, 
                static_folder=os.path.abspath('../web/dist'),
                static_url_path='')
    print("✓ Flask app created")
    
    print("\n4. Loading configuration...")
    app.config.from_object(Config.init_config())
    print("✓ Configuration loaded")
    
    print("\n5. Setting up CORS...")
    CORS(app)
    print("✓ CORS setup complete")
    
    print("\n6. Testing models import...")
    from models import db
    print("✓ Models imported")
    
    print("\n7. Initializing database...")
    db.init_app(app)
    print("✓ Database initialized")
    
    print("\n8. Adding basic route...")
    @app.route('/')
    def home():
        return "Server is working!"
    
    @app.route('/api/test')
    def test():
        return {"status": "ok", "message": "API is working"}
    
    print("\n9. Starting server...")
    print("Server will start on http://localhost:5000")
    print("=== SERVER STARTING ===")
    
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
    
except ImportError as e:
    print(f"\n❌ IMPORT ERROR: {e}")
    print("Missing dependency. Try: pip install -r requirements.txt")
    traceback.print_exc()
    
except Exception as e:
    print(f"\n❌ GENERAL ERROR: {e}")
    traceback.print_exc()
    
finally:
    print("\n=== DEBUG SESSION END ===")
