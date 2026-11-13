import os
import sys

# Test the static folder path resolution
current_dir = os.path.dirname(os.path.abspath(__file__))
static_path = os.path.abspath('../web/dist')
index_path = os.path.join(static_path, 'index.html')

print(f"Current directory: {current_dir}")
print(f"Static path: {static_path}")
print(f"Static folder exists: {os.path.exists(static_path)}")
print(f"Index.html path: {index_path}")
print(f"Index.html exists: {os.path.exists(index_path)}")

if os.path.exists(index_path):
    print(f"Index.html size: {os.path.getsize(index_path)} bytes")
    with open(index_path, 'r', encoding='utf-8') as f:
        content = f.read(200)  # First 200 characters
        print(f"Index.html content start: {repr(content)}")
