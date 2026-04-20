import requests
import os

# Test asset access
base_url = "http://localhost:5000"

print("Testing asset serving...")

# Test main page
try:
    response = requests.get(f"{base_url}/")
    print(f"Main page status: {response.status_code}")
    print(f"Main page content-type: {response.headers.get('content-type')}")
except Exception as e:
    print(f"Main page error: {e}")

# Test CSS asset
try:
    response = requests.get(f"{base_url}/assets/index-DcKGSXCq.css")
    print(f"CSS asset status: {response.status_code}")
    print(f"CSS content-type: {response.headers.get('content-type')}")
    print(f"CSS content length: {len(response.text)}")
except Exception as e:
    print(f"CSS asset error: {e}")

# Test JS asset
try:
    response = requests.get(f"{base_url}/assets/index-BZRu2-Gi.js")
    print(f"JS asset status: {response.status_code}")
    print(f"JS content-type: {response.headers.get('content-type')}")
    print(f"JS content length: {len(response.text)}")
except Exception as e:
    print(f"JS asset error: {e}")

# Check file system
assets_dir = os.path.abspath("../web/dist/assets")
print(f"\nFile system check:")
print(f"Assets directory: {assets_dir}")
print(f"Assets exists: {os.path.exists(assets_dir)}")

if os.path.exists(assets_dir):
    files = os.listdir(assets_dir)
    print(f"Asset files: {files}")
    
    js_file = os.path.join(assets_dir, "index-BZRu2-Gi.js")
    css_file = os.path.join(assets_dir, "index-DcKGSXCq.css")
    
    print(f"JS file exists: {os.path.exists(js_file)}")
    print(f"CSS file exists: {os.path.exists(css_file)}")
    
    if os.path.exists(js_file):
        print(f"JS file size: {os.path.getsize(js_file)} bytes")
