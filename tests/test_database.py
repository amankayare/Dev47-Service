import unittest
from unittest.mock import Mock, patch

from sqlalchemy import create_engine

from database import CloudflareD1Provider, SQLAlchemyProvider


class CloudflareD1ProviderTests(unittest.TestCase):
    def setUp(self):
        self.provider = CloudflareD1Provider(
            account_id="account",
            database_id="database",
            api_token="token",
        )

    @patch("database.requests.post")
    def test_execute_returns_rows_and_write_metadata(self, post):
        response = Mock()
        response.json.return_value = {
            "success": True,
            "result": [{
                "success": True,
                "results": [{"id": 7, "name": "sample"}],
                "meta": {"rows_written": 1, "last_row_id": 7},
            }],
        }
        post.return_value = response

        result = self.provider.execute(
            "SELECT id, name FROM projects WHERE id = ?", [7]
        )

        self.assertEqual(result.rows, [{"id": 7, "name": "sample"}])
        self.assertEqual(result.row_count, 1)
        self.assertEqual(result.last_insert_id, 7)
        self.assertEqual(post.call_args.kwargs["json"]["params"], [7])
        self.assertEqual(
            post.call_args.kwargs["headers"]["Authorization"], "Bearer token"
        )

    def test_execute_rejects_named_parameters(self):
        with self.assertRaisesRegex(TypeError, "positional"):
            self.provider.execute("SELECT :id", {"id": 7})

    @patch("database.requests.post")
    def test_execute_raises_on_cloudflare_query_error(self, post):
        response = Mock()
        response.json.return_value = {
            "success": False,
            "errors": [{"message": "invalid SQL"}],
        }
        post.return_value = response

        with self.assertRaisesRegex(RuntimeError, "invalid SQL"):
            self.provider.execute("SELECT invalid")


class SQLAlchemyProviderTests(unittest.TestCase):
    def test_execute_returns_rows(self):
        engine = create_engine("sqlite:///:memory:")
        provider = SQLAlchemyProvider(engine)

        result = provider.execute("SELECT ? AS value", [23])

        self.assertEqual(result.rows, [{"value": 23}])
        engine.dispose()


if __name__ == "__main__":
    unittest.main()
