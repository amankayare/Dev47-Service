import unittest
import sqlite3
from types import SimpleNamespace
from unittest.mock import Mock, patch

from sqlalchemy import create_engine
from sqlalchemy.orm import Session
from sqlalchemy.pool import NullPool

from database import (
    CloudflareD1Provider,
    QueryResult,
    SQLAlchemyProvider,
    _D1SQLiteDBAPI,
    _select_column_names,
    create_d1_sqlalchemy_engine_options,
)


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
    def test_execute_many_uses_d1_batch_api(self, post):
        response = Mock()
        response.json.return_value = {
            "success": True,
            "result": [
                {"success": True, "meta": {"changes": 1, "last_row_id": 3}},
                {"success": True, "meta": {"changes": 1, "last_row_id": 4}},
            ],
        }
        post.return_value = response

        result = self.provider.execute_many(
            "INSERT INTO users (username) VALUES (?)",
            [("first",), ("second",)],
        )

        self.assertEqual(result.row_count, 2)
        self.assertEqual(result.last_insert_id, 4)
        self.assertEqual(
            post.call_args.kwargs["json"],
            {
                "batch": [
                    {
                        "sql": "INSERT INTO users (username) VALUES (?)",
                        "params": ["first"],
                    },
                    {
                        "sql": "INSERT INTO users (username) VALUES (?)",
                        "params": ["second"],
                    },
                ]
            },
        )

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


class D1SQLAlchemyAdapterTests(unittest.TestCase):
    @patch("database.requests.post")
    def test_engine_options_send_sql_to_d1_over_http(self, post):
        response = Mock()
        response.json.return_value = {
            "success": True,
            "result": [{
                "success": True,
                "results": [{"1": 1}],
                "meta": {"changes": 0},
            }],
        }
        post.return_value = response
        config = SimpleNamespace(
            CLOUDFLARE_ACCOUNT_ID="account",
            CLOUDFLARE_D1_DATABASE_ID="database",
            CLOUDFLARE_API_TOKEN="token",
            CLOUDFLARE_D1_TIMEOUT=10,
        )

        engine = create_engine(
            "sqlite://",
            **create_d1_sqlalchemy_engine_options(config),
        )
        try:
            with engine.connect() as connection:
                self.assertEqual(connection.exec_driver_sql("SELECT 1").scalar(), 1)
        finally:
            engine.dispose()

        self.assertIn("/accounts/account/d1/database/database/query", post.call_args.args[0])
        self.assertEqual(post.call_args.kwargs["json"]["sql"], "SELECT 1")

    def test_infers_selected_column_names_for_empty_d1_results(self):
        sql = (
            'SELECT "users"."id" AS "users_id", '
            '"users"."username" AS "users_username" FROM "users" '
            'WHERE "users"."id" = ?'
        )

        self.assertEqual(
            _select_column_names(sql),
            ("users_id", "users_username"),
        )

    def test_sqlalchemy_queries_use_d1_dbapi_adapter(self):
        remote_database = sqlite3.connect(":memory:")

        class D1HTTPEmulator:
            def execute(self, sql, params=()):
                cursor = remote_database.cursor()
                try:
                    cursor.execute(sql, params)
                    raw_rows = cursor.fetchall()
                    columns = (
                        tuple(item[0] for item in cursor.description or ())
                        if raw_rows
                        else ()
                    )
                    rows = [
                        dict(zip(columns, row))
                        for row in raw_rows
                    ]
                    result = QueryResult(
                        rows=rows,
                        row_count=cursor.rowcount,
                        last_insert_id=cursor.lastrowid,
                        columns=columns,
                    )
                    remote_database.commit()
                    return result
                except sqlite3.Error:
                    remote_database.rollback()
                    raise
                finally:
                    cursor.close()

        engine = create_engine(
            "sqlite://",
            module=_D1SQLiteDBAPI(D1HTTPEmulator()),
            poolclass=NullPool,
        )
        from models import User, db

        try:
            db.metadata.create_all(engine)
            with Session(engine) as session:
                session.add(
                    User(
                        username="local-debug",
                        email="local-debug@example.test",
                        password_hash="test-hash",
                    )
                )
                session.commit()

                found = session.query(User).filter_by(username="local-debug").first()
                empty_result = session.query(User).filter_by(username="missing").all()

                self.assertEqual(found.username, "local-debug")
                self.assertEqual(empty_result, [])
        finally:
            engine.dispose()
            remote_database.close()


if __name__ == "__main__":
    unittest.main()
