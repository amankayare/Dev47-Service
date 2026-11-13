import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import pg from "pg";

const MIGRATION_VERSION = "0001_initial";
const MIGRATION_TABLE = "dev47_schema_migrations";
const APPLICATION_TABLES = [
  "about",
  "authors",
  "blog_categories",
  "blog_tags",
  "blogs",
  "certifications",
  "comments",
  "contact_messages",
  "experiences",
  "projects",
  "tags",
  "technical_skills",
  "users",
];
const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

async function main() {
  const backend = process.env.DATABASE_BACKEND?.trim().toLowerCase();
  if (backend !== "sqlalchemy") {
    throw new Error(
      "SQL migrations require DATABASE_BACKEND=SQLAlchemy; D1 uses Wrangler migrations.",
    );
  }
  if (process.env.DATABASE_MIGRATION_CONFIRM !== "apply") {
    throw new Error(
      "Set DATABASE_MIGRATION_CONFIRM=apply to confirm the target database before applying schema changes.",
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to apply SQL migrations.");
  }

  if (databaseUrl.startsWith("sqlite:///")) {
    await migrateSqlite(databaseUrl);
    return;
  }
  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    await migratePostgres(databaseUrl);
    return;
  }
  throw new Error(
    "DATABASE_URL must use sqlite:/// or postgresql:// to apply SQL migrations.",
  );
}

async function readMigration(dialect) {
  return readFile(
    path.join(
      projectDirectory,
      "migrations",
      dialect,
      `${MIGRATION_VERSION}.sql`,
    ),
    "utf8",
  );
}

async function migrateSqlite(databaseUrl) {
  let filename = databaseUrl.slice("sqlite:///".length);
  if (!filename) {
    throw new Error("DATABASE_URL must include a SQLite database path.");
  }
  if (process.platform === "win32" && /^\/[a-z]:\//i.test(filename)) {
    filename = filename.slice(1);
  }

  const require = createRequire(import.meta.url);
  const Database = require("better-sqlite3");
  const database = new Database(filename);
  try {
    database.pragma("foreign_keys = ON");
    const migrationTable = database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
      )
      .get(MIGRATION_TABLE);
    if (migrationTable) {
      const applied = database
        .prepare(`SELECT version FROM ${MIGRATION_TABLE} WHERE version = ?`)
        .get(MIGRATION_VERSION);
      if (applied) {
        console.info(`Migration ${MIGRATION_VERSION} is already applied.`);
        return;
      }
    }

    const existingTables = database
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${APPLICATION_TABLES.map(() => "?").join(", ")})`,
      )
      .all(...APPLICATION_TABLES)
      .map(({ name }) => name);
    assertFreshSchema(existingTables);

    const migration = await readMigration("sqlite");
    database.exec("BEGIN IMMEDIATE");
    try {
      database.exec(`
        CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
          version TEXT PRIMARY KEY,
          applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);
      database.exec(migration);
      database
        .prepare(`INSERT INTO ${MIGRATION_TABLE} (version) VALUES (?)`)
        .run(MIGRATION_VERSION);
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    console.info(`Applied migration ${MIGRATION_VERSION} to SQLite.`);
  } finally {
    database.close();
  }
}

async function migratePostgres(connectionString) {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    const client = await pool.connect();
    try {
      const migrationTable = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = $1",
        [MIGRATION_TABLE],
      );
      if (migrationTable.rowCount) {
        const applied = await client.query(
          `SELECT version FROM ${MIGRATION_TABLE} WHERE version = $1`,
          [MIGRATION_VERSION],
        );
        if (applied.rowCount) {
          console.info(`Migration ${MIGRATION_VERSION} is already applied.`);
          return;
        }
      }

      const existingTables = await client.query(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1::text[])",
        [APPLICATION_TABLES],
      );
      assertFreshSchema(existingTables.rows.map(({ table_name }) => table_name));

      const migration = await readMigration("postgres");
      await client.query("BEGIN");
      try {
        await client.query(`
          CREATE TABLE IF NOT EXISTS ${MIGRATION_TABLE} (
            version TEXT PRIMARY KEY,
            applied_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT (timezone('UTC', now()))
          )
        `);
        await client.query(migration);
        await client.query(
          `INSERT INTO ${MIGRATION_TABLE} (version) VALUES ($1)`,
          [MIGRATION_VERSION],
        );
        await client.query("COMMIT");
      } catch (error) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "Migration failed and its transaction could not be rolled back.",
          );
        }
        throw error;
      }
      console.info(`Applied migration ${MIGRATION_VERSION} to PostgreSQL.`);
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

function assertFreshSchema(existingTables) {
  if (existingTables.length > 0) {
    throw new Error(
      `Existing application tables found (${existingTables.join(", ")}); refusing to apply the initial migration.`,
    );
  }
}

main().catch((error) => {
  console.error("SQL migration failed:", error);
  process.exitCode = 1;
});
