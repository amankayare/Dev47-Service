from flask import Flask, jsonify
import os
import json

app = Flask(__name__)

@app.route('/debug/assets')
def debug_assets():
    """Debug endpoint to check asset availability"""
    static_folder = os.path.abspath('../web/dist')
    assets_folder = os.path.join(static_folder, 'assets')
    
    result = {
        "static_folder": static_folder,
        "static_folder_exists": os.path.exists(static_folder),
        "assets_folder": assets_folder,
        "assets_folder_exists": os.path.exists(assets_folder),
        "files_in_static": [],
        "files_in_assets": []
    }
    
    if os.path.exists(static_folder):
        result["files_in_static"] = os.listdir(static_folder)
    
    if os.path.exists(assets_folder):
        result["files_in_assets"] = os.listdir(assets_folder)
    
    return jsonify(result)

@app.route('/debug/index')
def debug_index():
    """Return the index.html content for debugging"""
    static_folder = os.path.abspath('../web/dist')
    index_file = os.path.join(static_folder, 'index.html')
    
    if os.path.exists(index_file):
        with open(index_file, 'r', encoding='utf-8') as f:
            content = f.read()
        return f"<pre>{content}</pre>"
    else:
        return {"error": "index.html not found"}, 404

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
