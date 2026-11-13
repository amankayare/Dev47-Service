import sys
import traceback
import datetime

# Redirect output to a log file
log_file = open('debug.log', 'w')
sys.stdout = log_file
sys.stderr = log_file

print(f"Starting debug at {datetime.datetime.now()}")

try:
    print("Step 1: Testing basic imports...")
    
    from flask import Flask
    print("✓ Flask imported")
    
    from flask_cors import CORS
    print("✓ CORS imported")
    
    print("Step 2: Creating Flask app...")
    app = Flask(__name__)
    CORS(app)
    
    @app.route('/')
    def home():
        return "Debug server working"
    
    print("Step 3: Starting server...")
    app.run(host='0.0.0.0', port=5000, debug=False)
    
except Exception as e:
    print(f"ERROR: {str(e)}")
    print(f"TRACEBACK: {traceback.format_exc()}")
    
finally:
    log_file.close()
