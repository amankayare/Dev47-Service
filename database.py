from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime, time
from decimal import Decimal
import re
import sqlite3
from typing import Any, Dict, Mapping, Optional

import requests
from sqlalchemy import text
from sqlalchemy.pool import NullPool


@dataclass(frozen=True)
class QueryResult:
    rows: list[Dict[str, Any]]
    row_count: Optional[int] = None
    last_insert_id: Optional[int] = None
    columns: tuple[str, ...] = ()


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
            json={
                "sql": sql,
                "params": [_serialize_d1_parameter(value) for value in params],
            },
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

        return self._result_from_statement(results[0], sql)

    def execute_many(self, sql: str, parameter_sets) -> QueryResult:
        batch = []
        for params in parameter_sets:
            if isinstance(params, Mapping):
                raise TypeError("Cloudflare D1 requires positional SQL parameters.")
            batch.append({
                "sql": sql,
                "params": [_serialize_d1_parameter(value) for value in params],
            })
        if not batch:
            return QueryResult(rows=[], row_count=0)

        response = requests.post(
            self.endpoint,
            headers=self.headers,
            json={"batch": batch},
            timeout=self.timeout,
        )
        response.raise_for_status()
        payload = response.json()
        if not isinstance(payload, dict) or not payload.get("success"):
            errors = payload.get("errors", []) if isinstance(payload, dict) else []
            message = "; ".join(
                error.get("message", str(error)) if isinstance(error, dict) else str(error)
                for error in errors
            )
            raise RuntimeError(
                f"Cloudflare D1 batch failed: {message or 'invalid API response'}"
            )

        results = payload.get("result")
        if not isinstance(results, list) or len(results) != len(batch):
            raise RuntimeError("Cloudflare D1 returned an invalid batch response.")

        changes = 0
        last_insert_id = None
        for result in results:
            if not isinstance(result, dict) or not result.get("success", True):
                raise RuntimeError("Cloudflare D1 reported that a batch statement failed.")
            meta = result.get("meta") or {}
            changes += meta.get("changes", meta.get("rows_written", 0)) or 0
            if meta.get("last_row_id") is not None:
                last_insert_id = meta["last_row_id"]
        return QueryResult(rows=[], row_count=changes, last_insert_id=last_insert_id)

    @staticmethod
    def _result_from_statement(statement_result, sql):
        if not isinstance(statement_result, dict):
            raise RuntimeError("Cloudflare D1 returned an invalid statement response.")
        if not statement_result.get("success", True):
            raise RuntimeError("Cloudflare D1 reported that the statement failed.")

        rows = statement_result.get("results") or []
        if not all(isinstance(row, dict) for row in rows):
            raise RuntimeError("Cloudflare D1 returned rows in an unexpected format.")

        meta = statement_result.get("meta") or {}
        columns = tuple(rows[0].keys()) if rows else _select_column_names(sql)
        return QueryResult(
            rows=rows,
            row_count=meta.get("changes", meta.get("rows_written")),
            last_insert_id=meta.get("last_row_id"),
            columns=columns,
        )


def _serialize_d1_parameter(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    raise TypeError(
        f"Cloudflare D1 HTTP parameters do not support {type(value).__name__} values."
    )


def _select_column_names(sql: str) -> tuple[str, ...]:
    """Infer result labels when D1 returns no rows and therefore no row keys."""
    pragma_match = re.match(
        r"\s*PRAGMA\s+(?:[\w]+\.)?([\w]+)",
        sql,
        flags=re.IGNORECASE,
    )
    if pragma_match:
        pragma_columns = {
            "database_list": ("seq", "name", "file"),
            "foreign_key_list": (
                "id", "seq", "table", "from", "to", "on_update", "on_delete", "match"
            ),
            "index_info": ("seqno", "cid", "name"),
            "index_list": ("seq", "name", "unique", "origin", "partial"),
            "table_info": (
                "cid", "name", "type", "notnull", "dflt_value", "pk"
            ),
            "table_xinfo": (
                "cid", "name", "type", "notnull", "dflt_value", "pk", "hidden"
            ),
        }
        return pragma_columns.get(pragma_match.group(1).lower(), ())

    depth = 0
    quote = None
    select_start = None
    from_start = None
    index = 0

    while index < len(sql):
        char = sql[index]
        if quote:
            if char == quote:
                if quote != "]" and index + 1 < len(sql) and sql[index + 1] == quote:
                    index += 1
                else:
                    quote = None
        elif char in ("'", '"', "`", "["):
            quote = "]" if char == "[" else char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif depth == 0 and (char.isalpha() or char == "_"):
            end = index + 1
            while end < len(sql) and (sql[end].isalnum() or sql[end] == "_"):
                end += 1
            keyword = sql[index:end].upper()
            if keyword == "SELECT" and select_start is None:
                select_start = end
            elif keyword == "FROM" and select_start is not None:
                from_start = index
                break
            index = end - 1
        index += 1

    if select_start is None:
        return ()
    projection_end = from_start if from_start is not None else len(sql)
    projection_sql = sql[select_start:projection_end].strip()

    expressions = []
    expression_start = 0
    depth = 0
    quote = None
    for index, char in enumerate(projection_sql):
        if quote:
            if char == quote:
                quote = None
        elif char in ("'", '"', "`", "["):
            quote = "]" if char == "[" else char
        elif char == "(":
            depth += 1
        elif char == ")":
            depth = max(0, depth - 1)
        elif char == "," and depth == 0:
            expressions.append(projection_sql[expression_start:index].strip())
            expression_start = index + 1
    expressions.append(projection_sql[expression_start:].strip())

    names = []
    for expression in expressions:
        alias_match = re.search(
            r'\s+AS\s+(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([A-Za-z_][\w$]*))\s*$',
            expression,
            flags=re.IGNORECASE,
        )
        if alias_match:
            names.append(next(group for group in alias_match.groups() if group is not None))
        else:
            column_match = re.search(r'(?:^|\.)(?:"([^"]+)"|`([^`]+)`|\[([^\]]+)\]|([\w$]+))\s*$', expression)
            names.append(
                next((group for group in column_match.groups() if group is not None), expression)
                if column_match else expression
            )
    return tuple(names)


class _D1SQLiteCursor:
    def __init__(self, provider):
        self._provider = provider
        self._rows = []
        self._position = 0
        self.description = None
        self.rowcount = -1
        self.lastrowid = None

    def execute(self, sql, parameters=()):
        params = () if parameters is None else parameters
        if isinstance(params, Mapping):
            raise sqlite3.ProgrammingError(
                "The D1 SQLite adapter requires positional SQL parameters."
            )
        try:
            result = self._provider.execute(sql, tuple(params))
        except requests.RequestException as error:
            raise sqlite3.OperationalError(str(error)) from error
        except RuntimeError as error:
            message = str(error)
            if any(
                marker in message.lower()
                for marker in (
                    "constraint failed",
                    "unique constraint",
                    "foreign key constraint",
                    "not null constraint",
                )
            ):
                raise sqlite3.IntegrityError(message) from error
            raise sqlite3.OperationalError(message) from error
        except TypeError as error:
            raise sqlite3.InterfaceError(str(error)) from error

        columns = result.columns or _select_column_names(sql)
        self.description = (
            [(name, None, None, None, None, None, None) for name in columns]
            if columns else None
        )
        self._rows = [
            tuple(row.get(name) for name in columns)
            for row in result.rows
        ]
        self._position = 0
        self.rowcount = result.row_count if result.row_count is not None else -1
        self.lastrowid = result.last_insert_id
        return self

    def executemany(self, sql, parameters):
        if not hasattr(self._provider, "execute_many"):
            raise sqlite3.NotSupportedError(
                "The configured database provider does not support executemany."
            )
        try:
            result = self._provider.execute_many(sql, parameters)
        except requests.RequestException as error:
            raise sqlite3.OperationalError(str(error)) from error
        except RuntimeError as error:
            message = str(error)
            if "constraint" in message.lower():
                raise sqlite3.IntegrityError(message) from error
            raise sqlite3.OperationalError(message) from error
        except TypeError as error:
            raise sqlite3.InterfaceError(str(error)) from error
        self._rows = []
        self._position = 0
        self.description = None
        self.rowcount = result.row_count if result.row_count is not None else -1
        self.lastrowid = result.last_insert_id
        return self

    def fetchone(self):
        if self._position >= len(self._rows):
            return None
        row = self._rows[self._position]
        self._position += 1
        return row

    def fetchmany(self, size=None):
        if size is None:
            size = self.arraysize
        rows = self._rows[self._position:self._position + size]
        self._position += len(rows)
        return rows

    def fetchall(self):
        rows = self._rows[self._position:]
        self._position = len(self._rows)
        return rows

    @property
    def arraysize(self):
        return getattr(self, "_arraysize", 1)

    @arraysize.setter
    def arraysize(self, value):
        self._arraysize = value

    def setinputsizes(self, sizes):
        return None

    def setoutputsize(self, size, column=None):
        return None

    def close(self):
        self._rows = []
        self._position = 0


class _D1SQLiteConnection:
    def __init__(self, provider):
        self._provider = provider
        self._closed = False
        self.isolation_level = None

    def cursor(self):
        if self._closed:
            raise sqlite3.ProgrammingError("Cannot use a closed D1 connection.")
        return _D1SQLiteCursor(self._provider)

    def commit(self):
        # The D1 HTTP query API commits each request independently.
        return None

    def rollback(self):
        return None

    def close(self):
        self._closed = True

    def create_function(self, name, num_params, function, **kwargs):
        if name not in {"regexp", "floor"}:
            raise sqlite3.NotSupportedError(
                "User-defined SQLite functions are not supported by Cloudflare D1."
            )


class _D1SQLiteDBAPI:
    apilevel = "2.0"
    paramstyle = "qmark"
    threadsafety = 1
    sqlite_version = sqlite3.sqlite_version
    sqlite_version_info = sqlite3.sqlite_version_info
    Warning = sqlite3.Warning
    Error = sqlite3.Error
    InterfaceError = sqlite3.InterfaceError
    DatabaseError = sqlite3.DatabaseError
    DataError = sqlite3.DataError
    OperationalError = sqlite3.OperationalError
    IntegrityError = sqlite3.IntegrityError
    InternalError = sqlite3.InternalError
    ProgrammingError = sqlite3.ProgrammingError
    NotSupportedError = sqlite3.NotSupportedError
    Binary = sqlite3.Binary
    PARSE_DECLTYPES = sqlite3.PARSE_DECLTYPES
    PARSE_COLNAMES = sqlite3.PARSE_COLNAMES

    def __init__(self, provider):
        self._provider = provider

    def connect(self, *args, **kwargs):
        return _D1SQLiteConnection(self._provider)


def create_d1_sqlalchemy_engine_options(config):
    provider = CloudflareD1Provider(
        account_id=config.CLOUDFLARE_ACCOUNT_ID,
        database_id=config.CLOUDFLARE_D1_DATABASE_ID,
        api_token=config.CLOUDFLARE_API_TOKEN,
        timeout=config.CLOUDFLARE_D1_TIMEOUT,
    )
    return {
        "module": _D1SQLiteDBAPI(provider),
        "poolclass": NullPool,
    }


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
