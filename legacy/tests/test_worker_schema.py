import sqlite3
import tempfile
import unittest
from pathlib import Path

from sqlalchemy import create_engine

from models import db


ROOT = Path(__file__).resolve().parents[1]
SQLITE_MIGRATION = (
    ROOT / "worker-api" / "migrations" / "sqlite" / "0001_initial.sql"
)
D1_MIGRATION = ROOT / "worker-api" / "migrations" / "d1" / "0001_initial.sql"


def sqlite_schema(connection):
    table_names = {
        row[0]
        for row in connection.execute(
            "SELECT name FROM sqlite_master "
            "WHERE type = 'table' AND name NOT LIKE 'sqlite_%'"
        )
    }
    return {
        table: {
            "columns": {
                row[1]: (row[2].upper(), row[3], row[5])
                for row in connection.execute(f'PRAGMA table_info("{table}")')
            },
            "foreign_keys": sorted(
                (row[2], row[3], row[4], row[6])
                for row in connection.execute(
                    f'PRAGMA foreign_key_list("{table}")'
                )
            ),
            "unique_indexes": sorted(
                tuple(
                    column[2]
                    for column in connection.execute(
                        f'PRAGMA index_info("{index[1]}")'
                    )
                )
                for index in connection.execute(
                    f'PRAGMA index_list("{table}")'
                )
                if index[2]
            ),
        }
        for table in sorted(table_names)
    }


class WorkerSchemaMigrationTests(unittest.TestCase):
    def test_sqlite_and_d1_initial_migrations_match(self):
        self.assertEqual(SQLITE_MIGRATION.read_text(), D1_MIGRATION.read_text())

    def test_sqlite_migration_matches_flask_model_schema(self):
        with tempfile.TemporaryDirectory() as temporary_directory:
            source_path = Path(temporary_directory) / "flask-schema.sqlite"
            engine = create_engine(f"sqlite:///{source_path.as_posix()}")
            try:
                db.metadata.create_all(engine)
            finally:
                engine.dispose()

            source = sqlite3.connect(source_path)
            target = sqlite3.connect(":memory:")
            try:
                target.execute("PRAGMA foreign_keys=ON")
                target.executescript(SQLITE_MIGRATION.read_text())
                self.assertEqual(sqlite_schema(source), sqlite_schema(target))
            finally:
                source.close()
                target.close()


if __name__ == "__main__":
    unittest.main()
