from flask import Flask

app = Flask(__name__)

@app.route('/')
def home():
    return "Simple Flask test - working!"

if __name__ == '__main__':
    print("Starting simple Flask app...")
    app.run(host='0.0.0.0', port=5003, debug=True)
