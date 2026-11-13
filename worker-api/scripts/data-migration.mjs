import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { createReadStream, createWriteStream } from "node:fs";
import {
  link,
  mkdir,
  readFile,
  rm,
} from "node:fs/promises";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createInterface } from "node:readline";
import pg from "pg";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
pg.types.setTypeParser(1082, (value) => value);
pg.types.setTypeParser(1114, (value) => value);
const VERSION = 1;
const APPLICATION_TABLES = [
  "users",
  "contact_messages",
  "projects",
  "blog_categories",
  "tags",
  "authors",
  "blogs",
  "blog_tags",
  "certifications",
  "about",
  "technical_skills",
  "experiences",
  "comments",
];
const BOOLEAN_COLUMNS = new Set([
  "is_admin",
  "is_read",
  "is_visible",
  "is_featured",
  "featured",
  "is_current",
]);
const JSON_COLUMNS = new Set([
  "tech",
  "links",
  "gallery",
  "categories",
  "quick_links",
  "skills",
  "social_links",
  "responsibilities",
  "achievements",
  "technologies",
]);
const DATE_COLUMNS = new Set(["start_date", "end_date", "expiration_date"]);
const TIMESTAMP_COLUMNS = new Set([
  "created_at",
  "updated_at",
  "last_login",
  "reset_password_expires",
  "read_at",
]);
const MIGRATION_TABLE = "dev47_schema_migrations";
const MIGRATION_VERSION = "0001_initial";
const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const repositoryDirectory = path.resolve(projectDirectory, "..");

function hash() {
  return createHash("sha256");
}

function assertOutsideRepository(targetPath) {
  const resolvedPath = path.resolve(targetPath).toLowerCase();
  const resolvedRepository = repositoryDirectory.toLowerCase();
  if (
    resolvedPath === resolvedRepository ||
    resolvedPath.startsWith(`${resolvedRepository}${path.sep.toLowerCase()}`)
  ) {
    throw new Error(
      "Data snapshots and import files must be written outside the repository.",
    );
  }
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeValue(column, value, table) {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_COLUMNS.has(column)) {
    return value === true || value === 1 || value === "1";
  }
  if (JSON_COLUMNS.has(column)) {
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch (error) {
        throw new Error(`Invalid JSON in column '${column}'.`, { cause: error });
      }
    }
    return value;
  }
  if (DATE_COLUMNS.has(column)) {
    return String(value).slice(0, 10);
  }
  if (TIMESTAMP_COLUMNS.has(column) || (table === "blogs" && column === "date")) {
    return String(value).replace(" ", "T");
  }
  return value;
}

function normalizeRow(row, table) {
  return Object.fromEntries(
    Object.entries(row).map(([column, value]) => [
      column,
      normalizeValue(column, value, table),
    ]),
  );
}

async function writeLine(stream, line) {
  if (!stream.write(`${line}\n`)) {
    await new Promise((resolve, reject) => {
      const cleanup = () => {
        stream.off("drain", onDrain);
        stream.off("error", onError);
      };
      const onDrain = () => {
        cleanup();
        resolve();
      };
      const onError = (error) => {
        cleanup();
        reject(error);
      };
      stream.once("drain", onDrain);
      stream.once("error", onError);
    });
  }
}

function getSqliteSchema(database) {
  const existing = new Set(
    database
      .prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
      )
      .all()
      .map(({ name }) => name),
  );
  const missing = APPLICATION_TABLES.filter((table) => !existing.has(table));
  if (missing.length) {
    throw new Error(`Source database is missing tables: ${missing.join(", ")}.`);
  }

  return APPLICATION_TABLES.map((table) => {
    const columns = database
      .prepare(`PRAGMA table_info("${table}")`)
      .all()
      .map((column) => ({
        name: column.name,
        type: column.type,
        primaryKeyOrder: column.pk,
      }));
    const primaryKeys = columns
      .filter((column) => column.primaryKeyOrder > 0)
      .sort((a, b) => a.primaryKeyOrder - b.primaryKeyOrder)
      .map((column) => column.name);
    if (!primaryKeys.length) {
      throw new Error(`Source table '${table}' has no primary key.`);
    }
    return { table, columns, primaryKeys };
  });
}

function assertSqliteIntegrity(database) {
  const integrity = database.pragma("integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error("SQLite data failed integrity_check.");
  }
  const foreignKeyErrors = database.pragma("foreign_key_check");
  if (foreignKeyErrors.length) {
    throw new Error(
      `SQLite data contains foreign-key violations (${foreignKeyErrors.length}).`,
    );
  }
}

export async function exportSqliteSnapshot(
  sourcePath,
  outputDirectory,
  sourceDialect = "sqlite",
) {
  assertOutsideRepository(outputDirectory);
  const source = new Database(sourcePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return await writeSqliteSnapshot(source, outputDirectory, sourceDialect);
  } finally {
    source.close();
  }
}

async function writeSqliteSnapshot(source, outputDirectory, sourceDialect) {
  assertOutsideRepository(outputDirectory);
  let output;
  let outputDirectoryCreated = false;
  try {
    assertSqliteIntegrity(source);
    const schema = getSqliteSchema(source);
    await mkdir(outputDirectory, { recursive: false });
    outputDirectoryCreated = true;
    const dataPath = path.join(outputDirectory, "data.jsonl");
    const manifestPath = path.join(outputDirectory, "manifest.json");
    output = createWriteStream(dataPath, { flags: "wx" });
    const snapshotHash = hash();
    const tables = [];

    for (const { table, columns, primaryKeys } of schema) {
      const rowHash = hash();
      const names = columns.map(({ name }) => name);
      const orderBy = primaryKeys
        .map((name) => `"${name}"`)
        .join(", ");
      const rows = source
        .prepare(`SELECT * FROM "${table}" ORDER BY ${orderBy}`)
        .iterate();
      let rowCount = 0;
      for (const rawRow of rows) {
        const row = normalizeRow(rawRow, table);
        const line = JSON.stringify({ table, row });
        await writeLine(output, line);
        snapshotHash.update(`${line}\n`);
        rowHash.update(`${stableJson(row)}\n`);
        rowCount += 1;
      }
      tables.push({
        table,
        columns: names,
        primaryKeys,
        rowCount,
        sha256: rowHash.digest("hex"),
      });
    }

    output.end();
    await once(output, "finish");
    const manifest = {
      formatVersion: VERSION,
      createdAt: new Date().toISOString(),
      sourceDialect,
      tables,
      snapshotSha256: snapshotHash.digest("hex"),
    };
    await writeFileExclusive(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    return manifest;
  } catch (error) {
    if (output && !output.closed) {
      await new Promise((resolve) => {
        output.once("close", resolve);
        output.destroy();
      });
    }
    if (outputDirectoryCreated) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
    throw error;
  }
}

async function getPostgresSchema(client) {
  const foundTables = await client.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_type = 'BASE TABLE' AND table_name = ANY($1::text[])",
    [APPLICATION_TABLES],
  );
  const found = new Set(foundTables.rows.map(({ table_name }) => table_name));
  const missing = APPLICATION_TABLES.filter((table) => !found.has(table));
  if (missing.length) {
    throw new Error(`Source database is missing tables: ${missing.join(", ")}.`);
  }

  const schema = [];
  for (const table of APPLICATION_TABLES) {
    const columnResult = await client.query(
      "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1 ORDER BY ordinal_position",
      [table],
    );
    const primaryKeyResult = await client.query(
      "SELECT kcu.column_name FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema AND tc.table_name = kcu.table_name WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = current_schema() AND tc.table_name = $1 ORDER BY kcu.ordinal_position",
      [table],
    );
    const columns = columnResult.rows.map(({ column_name, data_type }) => ({
      name: column_name,
      type: data_type,
      primaryKeyOrder: 0,
    }));
    const primaryKeys = primaryKeyResult.rows.map(
      ({ column_name }) => column_name,
    );
    if (!columns.length || !primaryKeys.length) {
      throw new Error(`Source table '${table}' has no columns or primary key.`);
    }
    for (const [index, column] of primaryKeys.entries()) {
      const definition = columns.find(({ name }) => name === column);
      if (!definition) {
        throw new Error(`Primary key column missing from '${table}'.`);
      }
      definition.primaryKeyOrder = index + 1;
    }
    schema.push({ table, columns, primaryKeys });
  }
  return schema;
}

async function* iteratePostgresTable(client, table, primaryKeys) {
  const orderBy = primaryKeys.map((column) => `"${column}"`).join(", ");
  const tuple = `(${orderBy})`;
  let lastValues;
  while (true) {
    const params = lastValues ? [...lastValues, 500] : [500];
    const afterLast = lastValues
      ? `WHERE ${tuple} > (${lastValues.map((_, i) => `$${i + 1}`).join(", ")})`
      : "";
    const result = await client.query(
      `SELECT * FROM "${table}" ${afterLast} ORDER BY ${orderBy} LIMIT $${params.length}`,
      params,
    );
    if (result.rows.length === 0) return;
    for (const row of result.rows) yield row;
    const lastRow = result.rows[result.rows.length - 1];
    lastValues = primaryKeys.map((column) => lastRow[column]);
  }
}

export async function exportPostgresSnapshot(connectionString, outputDirectory) {
  assertOutsideRepository(outputDirectory);
  const pool = new pg.Pool({ connectionString, max: 1 });
  let client;
  let output;
  let outputDirectoryCreated = false;
  try {
    client = await pool.connect();
    await client.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    const schema = await getPostgresSchema(client);
    await mkdir(outputDirectory, { recursive: false });
    outputDirectoryCreated = true;
    const dataPath = path.join(outputDirectory, "data.jsonl");
    const manifestPath = path.join(outputDirectory, "manifest.json");
    output = createWriteStream(dataPath, { flags: "wx" });
    const snapshotHash = hash();
    const tables = [];

    for (const { table, columns, primaryKeys } of schema) {
      const rowHash = hash();
      const names = columns.map(({ name }) => name);
      let rowCount = 0;
      for await (const rawRow of iteratePostgresTable(
        client,
        table,
        primaryKeys,
      )) {
        const row = normalizeRow(rawRow, table);
        const line = JSON.stringify({ table, row });
        await writeLine(output, line);
        snapshotHash.update(`${line}\n`);
        rowHash.update(`${stableJson(row)}\n`);
        rowCount += 1;
      }
      tables.push({
        table,
        columns: names,
        primaryKeys,
        rowCount,
        sha256: rowHash.digest("hex"),
      });
    }

    output.end();
    await once(output, "finish");
    const manifest = {
      formatVersion: VERSION,
      createdAt: new Date().toISOString(),
      sourceDialect: "postgres",
      tables,
      snapshotSha256: snapshotHash.digest("hex"),
    };
    await writeFileExclusive(
      manifestPath,
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    await client.query("COMMIT");
    return manifest;
  } catch (error) {
    if (output && !output.closed) {
      await new Promise((resolve) => {
        output.once("close", resolve);
        output.destroy();
      });
    }
    if (outputDirectoryCreated) {
      await rm(outputDirectory, { recursive: true, force: true });
    }
    if (client) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        throw new AggregateError(
          [error, rollbackError],
          "PostgreSQL snapshot failed and its read transaction could not be rolled back.",
        );
      }
    }
    throw error;
  } finally {
    client?.release();
    await pool.end();
  }
}

export async function exportD1SqlSnapshot(sqlExportPath, outputDirectory) {
  assertOutsideRepository(outputDirectory);
  const database = new Database(":memory:");
  try {
    database.pragma("foreign_keys = OFF");
    database.exec(
      await readFile(
        path.join(
          projectDirectory,
          "migrations",
          "sqlite",
          `${MIGRATION_VERSION}.sql`,
        ),
        "utf8",
      ),
    );
    database.exec(`
      CREATE TABLE d1_migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        applied_at TEXT
      )
    `);
    database.exec(await readFile(sqlExportPath, "utf8"));
    return await writeSqliteSnapshot(database, outputDirectory, "cloudflare_d1");
  } finally {
    database.close();
  }
}

async function writeFileExclusive(filename, content) {
  const stream = createWriteStream(filename, { flags: "wx" });
  stream.end(content);
  await once(stream, "finish");
}

async function validateSnapshot(snapshotDirectory) {
  const manifestPath = path.join(snapshotDirectory, "manifest.json");
  const dataPath = path.join(snapshotDirectory, "data.jsonl");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.formatVersion !== VERSION) {
    throw new Error(`Unsupported snapshot version: ${manifest.formatVersion}.`);
  }
  if (!["sqlite", "postgres", "cloudflare_d1"].includes(manifest.sourceDialect)) {
    throw new Error("Snapshot source dialect is invalid.");
  }
  if (!/^[a-f0-9]{64}$/i.test(manifest.snapshotSha256 ?? "")) {
    throw new Error("Snapshot manifest checksum is invalid.");
  }
  if (
    !Array.isArray(manifest.tables) ||
    manifest.tables.length !== APPLICATION_TABLES.length
  ) {
    throw new Error("Snapshot manifest does not contain the expected tables.");
  }

  const expectedTables = new Map(
    manifest.tables.map((table) => [table.table, table]),
  );
  if (
    APPLICATION_TABLES.some((table) => !expectedTables.has(table)) ||
    expectedTables.size !== APPLICATION_TABLES.length
  ) {
    throw new Error("Snapshot manifest is missing an application table.");
  }
  for (const [index, tableName] of APPLICATION_TABLES.entries()) {
    const table = manifest.tables[index];
    if (
      table.table !== tableName ||
      !Array.isArray(table.columns) ||
      new Set(table.columns).size !== table.columns.length ||
      table.columns.some(
        (column) =>
          typeof column !== "string" ||
          !/^[a-z_][a-z0-9_]*$/i.test(column),
      ) ||
      !Array.isArray(table.primaryKeys) ||
      !table.primaryKeys.length ||
      table.primaryKeys.some((key) => !table.columns.includes(key)) ||
      !Number.isSafeInteger(table.rowCount) ||
      table.rowCount < 0 ||
      !/^[a-f0-9]{64}$/i.test(table.sha256 ?? "")
    ) {
      throw new Error(`Snapshot manifest is invalid for table '${tableName}'.`);
    }
  }

  const perTable = new Map(
    manifest.tables.map(({ table }) => [table, { hash: hash(), rowCount: 0 }]),
  );
  const snapshotHash = hash();
  for await (const rawLine of createInterface({
    input: createReadStream(dataPath),
    crlfDelay: Infinity,
  })) {
    const line = `${rawLine}\n`;
    snapshotHash.update(line);
    let record;
    try {
      record = JSON.parse(line);
    } catch (error) {
      throw new Error("Snapshot contains invalid JSONL.", { cause: error });
    }
    if (
      !record ||
      typeof record.table !== "string" ||
      !expectedTables.has(record.table) ||
      !record.row ||
      Array.isArray(record.row) ||
      typeof record.row !== "object"
    ) {
      throw new Error("Snapshot contains an unknown table or malformed row.");
    }
    const table = perTable.get(record.table);
    const expectedColumns = expectedTables.get(record.table).columns;
    if (
      Object.keys(record.row).length !== expectedColumns.length ||
      expectedColumns.some((column) => !(column in record.row))
    ) {
      throw new Error(`Snapshot row has unexpected columns in '${record.table}'.`);
    }
    table.hash.update(`${stableJson(record.row)}\n`);
    table.rowCount += 1;
  }

  if (snapshotHash.digest("hex") !== manifest.snapshotSha256) {
    throw new Error("Snapshot data checksum does not match its manifest.");
  }
  for (const expected of manifest.tables) {
    const actual = perTable.get(expected.table);
    if (
      actual.rowCount !== expected.rowCount ||
      actual.hash.digest("hex") !== expected.sha256
    ) {
      throw new Error(`Snapshot verification failed for '${expected.table}'.`);
    }
  }
  return { manifest, dataPath };
}

async function* readSnapshotRows(dataPath) {
  for await (const rawLine of createInterface({
    input: createReadStream(dataPath),
    crlfDelay: Infinity,
  })) {
    yield JSON.parse(rawLine);
  }
}

function sqliteDatabaseFromUrl(databaseUrl) {
  let filename = databaseUrl.slice("sqlite:///".length);
  if (process.platform === "win32" && /^\/[a-z]:\//i.test(filename)) {
    filename = filename.slice(1);
  }
  if (!filename) throw new Error("SQLite DATABASE_URL must include a path.");
  return new Database(filename);
}

async function withTarget(databaseUrl, operation) {
  if (databaseUrl.startsWith("sqlite:///")) {
    const database = sqliteDatabaseFromUrl(databaseUrl);
    try {
      database.pragma("foreign_keys = ON");
      return await operation({
        dialect: "sqlite",
        database,
        query: (sql, params = []) => database.prepare(sql).all(...params),
        execute: (sql, params = []) => database.prepare(sql).run(...params),
        iterate: (table, primaryKeys) =>
          database
            .prepare(
              `SELECT * FROM "${table}" ORDER BY ${primaryKeys
                .map((column) => `"${column}"`)
                .join(", ")}`,
            )
            .iterate(),
        begin: () => database.exec("BEGIN IMMEDIATE"),
        commit: () => database.exec("COMMIT"),
        rollback: () => database.exec("ROLLBACK"),
      });
    } finally {
      database.close();
    }
  }
  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });
    let client;
    try {
      client = await pool.connect();
      return await operation({
        dialect: "postgres",
        query: async (sql, params = []) =>
          (await client.query(sql, params)).rows,
        execute: async (sql, params = []) =>
          client.query(sql, params),
        iterate: (table, primaryKeys) =>
          iteratePostgresTable(client, table, primaryKeys),
        begin: () => client.query("BEGIN"),
        commit: () => client.query("COMMIT"),
        rollback: () => client.query("ROLLBACK"),
      });
    } finally {
      client?.release();
      await pool.end();
    }
  }
  throw new Error("Target must use sqlite:/// or postgresql://.");
}

async function assertMigratedEmptyTarget(target, manifest) {
  if (target.dialect === "sqlite") {
    const version = target.database
      .prepare(
        `SELECT version FROM ${MIGRATION_TABLE} WHERE version = ?`,
      )
      .get(MIGRATION_VERSION);
    if (!version) throw new Error("Target initial schema migration is missing.");
    const columnsByTable = new Map(
      target.database
      .prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name IN (${APPLICATION_TABLES.map(() => "?").join(", ")})`,
      )
      .all(...APPLICATION_TABLES)
      .map(({ name: table }) => [
        table,
        target.database
          .prepare(`PRAGMA table_info("${table}")`)
          .all()
          .map(({ name }) => name),
      ]),
    );
    const missingTables = APPLICATION_TABLES.filter(
      (table) => !columnsByTable.has(table),
    );
    if (missingTables.length) {
      throw new Error(`Target is missing tables: ${missingTables.join(", ")}.`);
    }
    const populated = [];
    for (const expected of manifest.tables) {
      const table = expected.table;
      const targetColumns = columnsByTable.get(table);
      if (
        targetColumns.length !== expected.columns.length ||
        expected.columns.some((column) => !targetColumns.includes(column))
      ) {
        throw new Error(`Target schema columns do not match in '${table}'.`);
      }
      const [{ count }] = target.database
        .prepare(`SELECT COUNT(*) AS count FROM "${table}"`)
        .all();
      if (count > 0) populated.push(table);
    }
    if (populated.length) {
      throw new Error(
        `Target is not empty; refusing to import into: ${populated.join(", ")}.`,
      );
    }
    return;
  }

  const versions = await target.query(
    `SELECT version FROM ${MIGRATION_TABLE} WHERE version = $1`,
    [MIGRATION_VERSION],
  );
  if (!versions.length) throw new Error("Target initial schema migration is missing.");
  const counts = await target.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema = current_schema() AND table_name = ANY($1::text[])`,
    [APPLICATION_TABLES],
  );
  const foundTables = new Set(counts.map(({ table_name }) => table_name));
  const missingTables = APPLICATION_TABLES.filter(
    (table) => !foundTables.has(table),
  );
  if (missingTables.length) {
    throw new Error(`Target is missing tables: ${missingTables.join(", ")}.`);
  }
  for (const expected of manifest.tables) {
    const targetColumns = await target.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema = current_schema() AND table_name = $1",
      [expected.table],
    );
    const names = targetColumns.map(({ column_name }) => column_name);
    if (
      names.length !== expected.columns.length ||
      expected.columns.some((column) => !names.includes(column))
    ) {
      throw new Error(`Target schema columns do not match in '${expected.table}'.`);
    }
  }
  for (const { table_name: table } of counts) {
    const rows = await target.query(`SELECT COUNT(*) AS count FROM "${table}"`);
    if (Number(rows[0].count) > 0) {
      throw new Error(`Target is not empty; refusing to import into '${table}'.`);
    }
  }
}

function targetValue(column, value, dialect) {
  if (value === null || value === undefined) return null;
  if (BOOLEAN_COLUMNS.has(column) && dialect === "sqlite") {
    return value ? 1 : 0;
  }
  if (JSON_COLUMNS.has(column)) {
    return dialect === "sqlite" ? JSON.stringify(value) : value;
  }
  return value;
}

export async function importSnapshotToSql(snapshotDirectory, databaseUrl) {
  const { manifest, dataPath } = await validateSnapshot(snapshotDirectory);
  return withTarget(databaseUrl, async (target) => {
    let inTransaction = false;
    try {
      await target.begin();
      inTransaction = true;
      await assertMigratedEmptyTarget(target, manifest);
      const insertCache = new Map();
      for await (const { table, row } of readSnapshotRows(dataPath)) {
        const columns = manifest.tables.find((item) => item.table === table).columns;
        let statement = insertCache.get(table);
        if (!statement) {
          const names = columns.map((name) => `"${name}"`).join(", ");
          const placeholders = columns
            .map((_, index) =>
              target.dialect === "sqlite" ? "?" : `$${index + 1}`,
            )
            .join(", ");
          statement = `INSERT INTO "${table}" (${names}) VALUES (${placeholders})`;
          insertCache.set(table, statement);
        }
        const values = columns.map((column) =>
          targetValue(column, row[column], target.dialect),
        );
        await target.execute(statement, values);
      }
      if (target.dialect === "postgres") {
        for (const table of APPLICATION_TABLES.filter(
          (name) => name !== "blog_tags",
        )) {
          await target.execute(
            `SELECT setval(pg_get_serial_sequence('"${table}', 'id'), COALESCE(MAX(id), 1), MAX(id) IS NOT NULL) FROM "${table}"`,
          );
        }
      }
      await target.commit();
      inTransaction = false;
      return manifest;
    } catch (error) {
      if (inTransaction) {
        try {
          await target.rollback();
        } catch (rollbackError) {
          throw new AggregateError(
            [error, rollbackError],
            "Data import failed and its transaction could not be rolled back.",
          );
        }
      }
      throw error;
    }
  });
}

function sqlLiteral(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("Cannot export a non-finite number.");
    return String(value);
  }
  if (typeof value === "object") {
    return `'${JSON.stringify(value).replaceAll("'", "''")}'`;
  }
  return `'${String(value).replaceAll("'", "''")}'`;
}

export async function generateD1Import(snapshotDirectory, outputFile) {
  assertOutsideRepository(outputFile);
  const { manifest, dataPath } = await validateSnapshot(snapshotDirectory);
  const temporary = `${outputFile}.${randomUUID()}.tmp`;
  const output = createWriteStream(temporary, { flags: "wx" });
  try {
    const expectedCounts = manifest.tables
      .map(({ table, rowCount }) => `-- ${table}: ${rowCount} rows`)
      .join("\n");
    await writeLine(
      output,
      `-- Generated from verified snapshot ${manifest.snapshotSha256}`,
    );
    for (const line of expectedCounts.split("\n")) {
      if (line) await writeLine(output, line);
    }
    for await (const { table, row } of readSnapshotRows(dataPath)) {
      const columns = manifest.tables.find((item) => item.table === table).columns;
      const names = columns.map((name) => `"${name}"`).join(", ");
      const values = columns.map((column) => sqlLiteral(row[column])).join(", ");
      await writeLine(output, `INSERT INTO "${table}" (${names}) VALUES (${values});`);
    }
    output.end();
    await once(output, "finish");
    await link(temporary, outputFile);
    await rm(temporary);
    return manifest;
  } catch (error) {
    if (!output.closed) {
      await new Promise((resolve) => {
        output.once("close", resolve);
        output.destroy();
      });
    }
    await rm(temporary, { force: true });
    throw error;
  }
}

export async function verifySnapshotAgainstSql(
  snapshotDirectory,
  databaseUrl,
) {
  const { manifest } = await validateSnapshot(snapshotDirectory);
  return withTarget(databaseUrl, async (target) => {
    const mismatches = [];
    for (const expected of manifest.tables) {
      const rowHash = hash();
      let actualRows = 0;
      for await (const rawRow of target.iterate(
        expected.table,
        expected.primaryKeys,
      )) {
        rowHash.update(`${stableJson(normalizeRow(rawRow, expected.table))}\n`);
        actualRows += 1;
      }
      if (
        actualRows !== expected.rowCount ||
        rowHash.digest("hex") !== expected.sha256
      ) {
        mismatches.push({
          table: expected.table,
          expectedRows: expected.rowCount,
          actualRows,
        });
      }
    }
    if (mismatches.length) {
      throw new Error(
        `Data verification failed: ${JSON.stringify(mismatches)}`,
      );
    }
    return { verifiedTables: manifest.tables.length };
  });
}

export async function compareSnapshots(sourceDirectory, targetDirectory) {
  const { manifest: source } = await validateSnapshot(sourceDirectory);
  const { manifest: target } = await validateSnapshot(targetDirectory);
  const mismatches = [];
  for (const sourceTable of source.tables) {
    const targetTable = target.tables.find(
      ({ table }) => table === sourceTable.table,
    );
    if (
      !targetTable ||
      targetTable.rowCount !== sourceTable.rowCount ||
      targetTable.sha256 !== sourceTable.sha256
    ) {
      mismatches.push({
        table: sourceTable.table,
        expectedRows: sourceTable.rowCount,
        actualRows: targetTable?.rowCount ?? null,
      });
    }
  }
  if (mismatches.length) {
    throw new Error(`Snapshot comparison failed: ${JSON.stringify(mismatches)}`);
  }
  return { verifiedTables: source.tables.length };
}

function getSqlTargetUrl() {
  const backend = process.env.DATABASE_BACKEND?.trim().toLowerCase();
  if (backend !== "sqlalchemy") {
    throw new Error("SQL data migration requires DATABASE_BACKEND=SQLAlchemy.");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (
    !databaseUrl?.startsWith("sqlite:///") &&
    !databaseUrl?.startsWith("postgres://") &&
    !databaseUrl?.startsWith("postgresql://")
  ) {
    throw new Error(
      "DATABASE_URL must use sqlite:/// or postgresql:// for SQL data migration.",
    );
  }
  return databaseUrl;
}

function parseArgs(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    if (!key.startsWith("--")) throw new Error(`Unexpected argument '${key}'.`);
    const value = args[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Expected a value after '${key}'.`);
    }
    options[key.slice(2)] = value;
    index += 1;
  }
  return options;
}

async function main(args) {
  const [command, ...rest] = args;
  const options = parseArgs(rest);
  if (command === "export-sqlite") {
    if (!options.source || !options.output) {
      throw new Error("Usage: export-sqlite --source <snapshot.sqlite> --output <new-directory>");
    }
    const manifest = await exportSqliteSnapshot(options.source, options.output);
    console.info(`Exported ${manifest.tables.length} tables from SQLite snapshot.`);
    return;
  }
  if (command === "export-d1-sql") {
    if (!options.source || !options.output) {
      throw new Error(
        "Usage: export-d1-sql --source <Wrangler-D1-export.sql> --output <new-directory>",
      );
    }
    const manifest = await exportD1SqlSnapshot(options.source, options.output);
    console.info(`Exported ${manifest.tables.length} tables from the D1 SQL snapshot.`);
    return;
  }
  if (command === "export-postgres") {
    if (!options.output) {
      throw new Error(
        "Usage: export-postgres --output <new-directory>; set DATABASE_URL to a consistent PostgreSQL source snapshot.",
      );
    }
    const connectionString = process.env.DATABASE_URL?.trim();
    if (
      process.env.DATABASE_BACKEND?.trim().toLowerCase() !== "sqlalchemy" ||
      (!connectionString?.startsWith("postgres://") &&
        !connectionString?.startsWith("postgresql://"))
    ) {
      throw new Error(
        "DATABASE_URL must be a PostgreSQL connection URL for export-postgres.",
      );
    }
    const manifest = await exportPostgresSnapshot(
      connectionString,
      options.output,
    );
    console.info(`Exported ${manifest.tables.length} tables from PostgreSQL.`);
    return;
  }
  if (command === "import-sql") {
    if (
      !options.input ||
      process.env.DATABASE_MIGRATION_CONFIRM !== "import"
    ) {
      throw new Error(
        "Usage: import-sql --input <snapshot-directory>; set DATABASE_BACKEND=SQLAlchemy, DATABASE_URL in .env, and DATABASE_MIGRATION_CONFIRM=import.",
      );
    }
    await importSnapshotToSql(options.input, getSqlTargetUrl());
    console.info("Snapshot imported into SQL target.");
    return;
  }
  if (command === "generate-d1") {
    if (!options.input || !options.output) {
      throw new Error("Usage: generate-d1 --input <snapshot-directory> --output <new.sql-file>");
    }
    await generateD1Import(options.input, options.output);
    console.info("Generated D1 SQL import file; target database was not changed.");
    return;
  }
  if (command === "verify-sql") {
    if (!options.input) {
      throw new Error(
        "Usage: verify-sql --input <snapshot-directory>; set DATABASE_BACKEND=SQLAlchemy and DATABASE_URL in .env.",
      );
    }
    const result = await verifySnapshotAgainstSql(
      options.input,
      getSqlTargetUrl(),
    );
    console.info(`Verified ${result.verifiedTables} tables.`);
    return;
  }
  if (command === "compare-snapshots") {
    if (!options.source || !options.target) {
      throw new Error(
        "Usage: compare-snapshots --source <snapshot-directory> --target <snapshot-directory>",
      );
    }
    const result = await compareSnapshots(options.source, options.target);
    console.info(`Compared ${result.verifiedTables} tables successfully.`);
    return;
  }
  throw new Error(
    "Commands: export-sqlite, export-d1-sql, export-postgres, import-sql, generate-d1, verify-sql, compare-snapshots.",
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error("Data migration failed:", error);
    process.exitCode = 1;
  });
}
