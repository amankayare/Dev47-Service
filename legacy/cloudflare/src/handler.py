from urllib.parse import urlparse

from backend_core.health import api_health_response


def handle_request(method, request_url):
    path = urlparse(request_url).path
    if path == "/api/health":
        if method == "GET":
            return api_health_response()
        return {"error": "Method not allowed"}, 405

    return {"error": "Not found"}, 404
