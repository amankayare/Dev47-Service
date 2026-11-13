import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  exportSqliteSnapshot,
  exportD1SqlSnapshot,
  compareSnapshots,
  generateD1Import,
  importSnapshotToSql,
  verifySnapshotAgainstSql,
} from "./data-migration.mjs";

const require = createRequire(import.meta.url);
const Database = require("better-sqlite3");
const migrationPath = new URL(
  "../migrations/sqlite/0001_initial.sql",
  import.meta.url,
);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

async function createFixture() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dev47-data-migration-"));
  temporaryDirectories.push(directory);
  const sourcePath = path.join(directory, "source.sqlite");
  const targetPath = path.join(directory, "target.sqlite");
  const d1Path = path.join(directory, "d1-local.sqlite");
  const source = new Database(sourcePath);
  source.pragma("foreign_keys = ON");
  source.exec(await readFile(migrationPath, "utf8"));
  source.exec(`
    INSERT INTO users
      (id, username, email, password_hash, is_admin, created_at)
    VALUES (47, 'admin', 'admin@example.test', 'scrypt:hash-value', 1,
      '2026-01-02 03:04:05.123456');
    INSERT INTO contact_messages
      (id, name, email, subject, message, is_read, created_at)
    VALUES (12, 'User', 'user@example.test', 'Hello', 'It''s a test', 0,
      '2026-02-03 04:05:06');
    INSERT INTO projects
      (id, title, description, tech, links, categories, is_visible, is_featured)
    VALUES (21, 'Project', 'Description', '[\"TypeScript\",\"Workers\"]',
      '[{\"name\":\"repo\",\"url\":\"https://example.test/a?x=1&y=2\"}]',
      '[\"api\"]', 1, 1);
    INSERT INTO blog_categories (id, name) VALUES (31, 'Engineering');
    INSERT INTO tags (id, name) VALUES (41, 'Workers');
    INSERT INTO authors (id, name, email) VALUES (51, 'Author', NULL);
    INSERT INTO blogs
      (id, title, content, date, featured, is_visible, quick_links,
       category_id, author_id)
    VALUES (61, 'Migration', 'O''Reilly and Unicode: café',
      '2026-03-04 05:06:07.123456', 1, 1, '[{\"label\":\"SQL\"}]', 31, 51);
    INSERT INTO blog_tags (blog_id, tag_id) VALUES (61, 41);
    INSERT INTO certifications
      (id, name, issuer, date, skills, is_visible)
    VALUES (71, 'Certificate', 'Issuer', 'Issued 2025', '[\"SQL\"]', 1);
    INSERT INTO about (id, name, bio, social_links)
    VALUES (81, 'Profile', 'Bio', '{\"site\":\"https://example.test\"}');
    INSERT INTO technical_skills (id, title, skills, is_visible)
    VALUES (91, 'Backend', '[\"Node.js\"]', 1);
    INSERT INTO experiences
      (id, title, company, responsibilities, is_current, is_visible)
    VALUES (101, 'Developer', 'Company', '[\"Build systems\"]', 0, 1);
    INSERT INTO comments (id, content, author_id, blog_id)
    VALUES (111, 'Comment', 47, 61);
  `);
  source.close();

  const snapshotDirectory = path.join(directory, "snapshot");
  const manifest = await exportSqliteSnapshot(sourcePath, snapshotDirectory);
  const target = new Database(targetPath);
  target.pragma("foreign_keys = ON");
  target.exec(await readFile(migrationPath, "utf8"));
  target
    .prepare(
      "CREATE TABLE dev47_schema_migrations (version TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    )
    .run();
  target
    .prepare("INSERT INTO dev47_schema_migrations (version) VALUES (?)")
    .run("0001_initial");
  target.close();

  const d1Target = new Database(d1Path);
  d1Target.pragma("foreign_keys = ON");
  d1Target.exec(await readFile(migrationPath, "utf8"));
  d1Target.close();

  return {
    directory,
    sourcePath,
    targetPath,
    d1Path,
    snapshotDirectory,
    manifest,
  };
}

function sqliteUrl(filename) {
  return `sqlite:///${filename.replaceAll("\\", "/")}`;
}

describe("SQLite data migration workflow", () => {
  it("exports, imports, and verifies all rows and relationships", async () => {
    const fixture = await createFixture();

    await importSnapshotToSql(
      fixture.snapshotDirectory,
      sqliteUrl(fixture.targetPath),
    );
    await expect(
      verifySnapshotAgainstSql(
        fixture.snapshotDirectory,
        sqliteUrl(fixture.targetPath),
      ),
    ).resolves.toEqual({ verifiedTables: 13 });

    const target = new Database(fixture.targetPath, { readonly: true });
    try {
      expect(
        target.prepare("SELECT password_hash FROM users WHERE id = 47").get(),
      ).toEqual({ password_hash: "scrypt:hash-value" });
      expect(
        target.prepare("SELECT date FROM certifications WHERE id = 71").get(),
      ).toEqual({ date: "Issued 2025" });
      expect(
        target
          .prepare("SELECT content FROM blogs WHERE id = 61")
          .get().content,
      ).toBe("O'Reilly and Unicode: café");
      expect(
        target.prepare("SELECT * FROM blog_tags WHERE blog_id = 61").all(),
      ).toEqual([{ blog_id: 61, tag_id: 41 }]);
    } finally {
      target.close();
    }

    const manifest = JSON.parse(
      await readFile(path.join(fixture.snapshotDirectory, "manifest.json")),
    );
    expect(manifest.tables).toHaveLength(13);
    expect(manifest.tables.find((table) => table.table === "comments").rowCount)
      .toBe(1);
  });

  it("refuses a populated target without changing it", async () => {
    const fixture = await createFixture();
    const target = new Database(fixture.targetPath);
    target.exec("INSERT INTO users (id, username, email, password_hash) VALUES (5, 'existing', 'existing@example.test', 'hash')");
    target.close();

    await expect(
      importSnapshotToSql(
        fixture.snapshotDirectory,
        sqliteUrl(fixture.targetPath),
      ),
    ).rejects.toThrow("Target is not empty");

    const check = new Database(fixture.targetPath, { readonly: true });
    try {
      expect(check.prepare("SELECT id FROM users ORDER BY id").all()).toEqual([
        { id: 5 },
      ]);
    } finally {
      check.close();
    }
  });

  it("rejects a damaged snapshot before modifying a target", async () => {
    const fixture = await createFixture();
    const dataPath = path.join(fixture.snapshotDirectory, "data.jsonl");
    const lines = (await readFile(dataPath, "utf8")).trimEnd().split("\n");
    const firstRecord = JSON.parse(lines[0]);
    firstRecord.row.username = "tampered";
    lines[0] = JSON.stringify(firstRecord);
    await writeFile(dataPath, `${lines.join("\n")}\n`);

    await expect(
      importSnapshotToSql(
        fixture.snapshotDirectory,
        sqliteUrl(fixture.targetPath),
      ),
    ).rejects.toThrow("Snapshot data checksum");

    const target = new Database(fixture.targetPath, { readonly: true });
    try {
      expect(target.prepare("SELECT COUNT(*) AS count FROM users").get().count)
        .toBe(0);
    } finally {
      target.close();
    }
  });

  it("rolls back the full import when a foreign-key constraint fails", async () => {
    const fixture = await createFixture();
    const dataPath = path.join(fixture.snapshotDirectory, "data.jsonl");
    const manifestPath = path.join(fixture.snapshotDirectory, "manifest.json");
    const lines = (await readFile(dataPath, "utf8")).trimEnd().split("\n");
    const comment = JSON.parse(lines.at(-1));
    lines.push(
      JSON.stringify({
        table: "comments",
        row: {
          ...comment.row,
          id: 112,
          content: "Orphan",
          author_id: 999,
        },
      }),
    );
    await writeFile(dataPath, `${lines.join("\n")}\n`);

    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    const comments = manifest.tables.find(({ table }) => table === "comments");
    comments.rowCount += 1;
    const commentRows = lines
      .map((line) => JSON.parse(line))
      .filter(({ table }) => table === "comments")
      .map(({ row }) => ({
        ...row,
      }));
    const stableCommentRows = commentRows
      .map((row) =>
        `{${Object.keys(row)
          .sort()
          .map((key) => `${JSON.stringify(key)}:${JSON.stringify(row[key])}`)
          .join(",")}}`,
      )
      .map((row) => `${row}\n`)
      .join("");
    comments.sha256 = createHash("sha256")
      .update(stableCommentRows)
      .digest("hex");
    manifest.snapshotSha256 = createHash("sha256")
      .update(lines.map((line) => `${line}\n`).join(""))
      .digest("hex");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    await expect(
      importSnapshotToSql(
        fixture.snapshotDirectory,
        sqliteUrl(fixture.targetPath),
      ),
    ).rejects.toThrow(/FOREIGN KEY constraint failed/i);

    const target = new Database(fixture.targetPath, { readonly: true });
    try {
      expect(target.prepare("SELECT COUNT(*) AS count FROM users").get().count)
        .toBe(0);
      expect(
        target.prepare("SELECT COUNT(*) AS count FROM comments").get().count,
      ).toBe(0);
    } finally {
      target.close();
    }
  });

  it("generates D1 SQL that imports the snapshot without losing quoting", async () => {
    const fixture = await createFixture();
    const importPath = path.join(fixture.directory, "d1-import.sql");
    await generateD1Import(fixture.snapshotDirectory, importPath);

    const target = new Database(fixture.d1Path);
    try {
      target.exec(await readFile(importPath, "utf8"));
      expect(target.prepare("SELECT COUNT(*) AS count FROM users").get().count)
        .toBe(1);
      expect(
        target.prepare("SELECT content FROM blogs WHERE id = 61").get().content,
      ).toBe("O'Reilly and Unicode: café");
      expect(
        target.prepare("SELECT date FROM certifications WHERE id = 71").get(),
      ).toEqual({ date: "Issued 2025" });
    } finally {
      target.close();
    }
  });

  it("converts a data-only Wrangler D1 SQL export into a verified snapshot", async () => {
    const fixture = await createFixture();
    const sqlExportPath = path.join(fixture.directory, "d1-export.sql");
    const snapshotDirectory = path.join(fixture.directory, "d1-snapshot");
    await writeFile(
      sqlExportPath,
      `PRAGMA defer_foreign_keys=TRUE;\nINSERT INTO "d1_migrations" ("id","name","applied_at") VALUES(1,'0001_initial.sql','2026-01-02 03:04:05');\nINSERT INTO "users" ("id", "username", "email", "password_hash", "is_admin", "created_at") VALUES (47, 'admin', 'admin@example.test', 'scrypt:hash-value', TRUE, '2026-01-02 03:04:05.123456');\nINSERT INTO "sqlite_sequence" ("name","seq") VALUES('d1_migrations',1);\nINSERT INTO "sqlite_sequence" ("name","seq") VALUES('users',47);\n`,
    );

    const manifest = await exportD1SqlSnapshot(sqlExportPath, snapshotDirectory);
    expect(manifest.sourceDialect).toBe("cloudflare_d1");
    expect(manifest.tables.find((table) => table.table === "users").rowCount)
      .toBe(1);
    await expect(
      verifySnapshotAgainstSql(
        snapshotDirectory,
        sqliteUrl(fixture.targetPath),
      ),
    ).rejects.toThrow("Data verification failed");
  });

  it("compares source and target snapshots by row counts and canonical hashes", async () => {
    const fixture = await createFixture();
    const copy = path.join(fixture.directory, "snapshot-copy");
    const copyPath = path.join(fixture.directory, "copy.sqlite");
    await copyFile(fixture.sourcePath, copyPath);
    await exportSqliteSnapshot(copyPath, copy);

    await expect(
      compareSnapshots(fixture.snapshotDirectory, copy),
    ).resolves.toEqual({ verifiedTables: 13 });

    const copyDb = new Database(copyPath);
    copyDb.prepare("UPDATE users SET username = ? WHERE id = ?").run("changed", 47);
    copyDb.close();
    await rm(copy, { recursive: true, force: true });
    await exportSqliteSnapshot(copyPath, copy);
    await expect(
      compareSnapshots(fixture.snapshotDirectory, copy),
    ).rejects.toThrow("Snapshot comparison failed");
  });

  it("refuses to write sensitive snapshots inside the repository", async () => {
    const repositorySnapshot = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      ".test-migration-snapshot",
    );
    await expect(
      exportSqliteSnapshot("missing-source.sqlite", repositorySnapshot),
    ).rejects.toThrow("must be written outside the repository");
  });
});
