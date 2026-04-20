#!/usr/bin/env python3
"""
Minimal test server to check basic Flask functionality
"""
from flask import Flask, send_from_directory
import os

# Create Flask app with correct static folder
static_path = os.path.abspath('../web/dist')
app = Flask(__name__, static_folder=static_path, static_url_path='')

print(f"🔧 Static folder configured as: {static_path}")
print(f"📁 Static folder exists: {os.path.exists(static_path)}")

if os.path.exists(static_path):
    print("📄 Contents:")
    for item in os.listdir(static_path):
        print(f"  - {item}")

@app.route('/')
def serve_frontend():
    """Serve the React frontend"""
    try:
        index_path = os.path.join(app.static_folder, 'index.html')
        print(f"🌐 Trying to serve: {index_path}")
        print(f"📄 File exists: {os.path.exists(index_path)}")
        return send_from_directory(app.static_folder, 'index.html')
    except Exception as e:
        print(f"❌ Error serving index.html: {e}")
        return {"error": f"Cannot serve frontend: {str(e)}"}, 404

@app.route('/test')
def test():
    return {"status": "ok", "message": "Test server is working!"}, 200

if __name__ == "__main__":
    print("🚀 Starting test server...")
    app.run(host="0.0.0.0", port=5001, debug=True)
