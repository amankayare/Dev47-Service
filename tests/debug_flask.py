#!/usr/bin/env python3
"""
Debug script to check Flask configuration
"""
import os
import sys

# Add current directory to path
sys.path.insert(0, '.')

try:
    from app import app
    print("✅ Flask app imported successfully")
    print(f"📁 Static folder: {app.static_folder}")
    print(f"🔍 Static folder exists: {os.path.exists(app.static_folder)}")
    
    if os.path.exists(app.static_folder):
        print(f"📄 Contents of static folder:")
        for item in os.listdir(app.static_folder):
            print(f"  - {item}")
        
        index_path = os.path.join(app.static_folder, 'index.html')
        print(f"🌐 index.html exists: {os.path.exists(index_path)}")
        
        if os.path.exists(index_path):
            print(f"📏 index.html size: {os.path.getsize(index_path)} bytes")
    else:
        print("❌ Static folder does not exist!")
        
    print(f"🔧 Current working directory: {os.getcwd()}")
    print(f"📍 Absolute static path: {os.path.abspath(app.static_folder)}")
    
except Exception as e:
    print(f"❌ Error: {e}")
    import traceback
    traceback.print_exc()
