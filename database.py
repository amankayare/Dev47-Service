from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional

import requests
from sqlalchemy import text


@dataclass(frozen=True)
class QueryResult:
    rows: list[Dict[str, Any]]
    row_count: Optional[int] = None
    last_insert_id: Optional[int] = None


class DatabaseProvider(ABC):
    @abstractmethod
    def execute(self, sql: str, params: Any = ()) -> QueryResult:
        """Execute one statement and return any rows and write metadata."""

    def health_check(self):
        self.execute("SELECT 1")


class SQLAlchemyProvider(DatabaseProvider):
    def __init__(self, engine):
        self.engine = engine

    def execute(self, sql: str, params: Any = ()) -> QueryResult:
        with self.engine.begin() as connection:
            if isinstance(params, Mapping):
                result = connection.execute(text(sql), params)
            else:
                positional_params = tuple(params) if isinstance(params, list) else params
                result = connection.exec_driver_sql(sql, positional_params)
            rows = [dict(row) for row in result.mappings()] if result.returns_rows else []
            return QueryResult(rows=rows, row_count=result.rowcount)


class CloudflareD1Provider(DatabaseProvider):
    def __init__(
        self,
        account_id: str,
        database_id: str,
        api_token: str,
        timeout: int = 10,
    ):
        self.endpoint = (
            "https://api.cloudflare.com/client/v4/accounts/"
            f"{account_id}/d1/database/{database_id}/query"
        )
        self.headers = {
            "Authorization": f"Bearer {api_token}",
            "Content-Type": "application/json",
        }
        self.timeout = timeout

    def execute(self, sql: str, params: Any = ()) -> QueryResult:
        if isinstance(params, Mapping):
            raise TypeError("Cloudflare D1 requires positional query parameters.")
        if not isinstance(params, (list, tuple)):
            raise TypeError("Query parameters must be provided as a list or tuple.")

        response = requests.post(
            self.endpoint,
            headers=self.headers,
            json={"sql": sql, "params": list(params)},
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict):
            raise RuntimeError("Cloudflare D1 returned an invalid API response.")

        if not payload.get("success"):
            errors = payload.get("errors") or []
            message = "; ".join(
                error.get("message", str(error)) if isinstance(error, dict) else str(error)
                for error in errors
            )
            raise RuntimeError(f"Cloudflare D1 query failed: {message or 'unspecified API error'}")

        results = payload.get("result")
        if not isinstance(results, list) or not results:
            raise RuntimeError("Cloudflare D1 returned an invalid query response.")

        statement_result = results[0]
        if not isinstance(statement_result, dict):
            raise RuntimeError("Cloudflare D1 returned an invalid statement response.")
        if not statement_result.get("success", True):
            raise RuntimeError("Cloudflare D1 reported that the statement failed.")

        rows = statement_result.get("results") or []
        if not all(isinstance(row, dict) for row in rows):
            raise RuntimeError("Cloudflare D1 returned rows in an unexpected format.")

        meta = statement_result.get("meta") or {}
        return QueryResult(
            rows=rows,
            row_count=meta.get("rows_written", meta.get("changes")),
            last_insert_id=meta.get("last_row_id"),
        )


def create_database_provider(config, sqlalchemy_engine=None) -> DatabaseProvider:
    backend = config.DATABASE_BACKEND
    if backend == "sqlalchemy":
        if sqlalchemy_engine is None:
            raise ValueError("A SQLAlchemy engine is required for the sqlalchemy backend.")
        return SQLAlchemyProvider(sqlalchemy_engine)
    if backend == "cloudflare_d1":
        return CloudflareD1Provider(
            account_id=config.CLOUDFLARE_ACCOUNT_ID,
            database_id=config.CLOUDFLARE_D1_DATABASE_ID,
            api_token=config.CLOUDFLARE_API_TOKEN,
            timeout=config.CLOUDFLARE_D1_TIMEOUT,
        )
    raise ValueError(
        "DATABASE_BACKEND must be either 'sqlalchemy' or 'cloudflare_d1'."
    )
