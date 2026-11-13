import unittest

from backend_core.health import api_health_response
from cloudflare.src.handler import handle_request


class ApiHealthResponseTests(unittest.TestCase):
    def test_returns_shared_health_payload(self):
        body, status = api_health_response()

        self.assertEqual(status, 200)
        self.assertEqual(
            body,
            {"status": "ok", "message": "Portfolio API is running!"},
        )

    def test_worker_health_route_uses_shared_response(self):
        body, status = handle_request(
            "GET", "https://service.example/api/health?check=1"
        )

        self.assertEqual((body, status), api_health_response())

    def test_worker_returns_method_not_allowed_for_non_get_health(self):
        body, status = handle_request(
            "POST", "https://service.example/api/health"
        )

        self.assertEqual(status, 405)
        self.assertEqual(body, {"error": "Method not allowed"})

    def test_worker_returns_not_found_for_other_paths(self):
        body, status = handle_request(
            "GET", "https://service.example/api/projects"
        )

        self.assertEqual(status, 404)
        self.assertEqual(body, {"error": "Not found"})


if __name__ == "__main__":
    unittest.main()
