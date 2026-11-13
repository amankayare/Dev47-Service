import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import type Database from "better-sqlite3";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const DatabaseConstructor = require("better-sqlite3") as typeof Database;
const migrationPath = fileURLToPath(
  new URL("../../../migrations/sqlite/0001_initial.sql", import.meta.url),
);
const d1MigrationPath = fileURLToPath(
  new URL("../../../migrations/d1/0001_initial.sql", import.meta.url),
);

describe("initial SQL schema migration", () => {
  it("creates every modeled table and preserves foreign-key constraints", () => {
    const database = new DatabaseConstructor(":memory:");
    try {
      database.pragma("foreign_keys = ON");
      const migration = readFileSync(migrationPath, "utf8");
      expect(readFileSync(d1MigrationPath, "utf8")).toBe(migration);
      database.exec(migration);

      const tableRows = database
        .prepare(
          "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
        )
        .all() as { name: string }[];
      const tables = tableRows.map((row) => row.name);

      expect(tables).toEqual([
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
      ]);
      expect(database.pragma("foreign_key_list(comments)")).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ table: "blogs", on_delete: "CASCADE" }),
          expect.objectContaining({ table: "users" }),
        ]),
      );
    } finally {
      database.close();
    }
  });
});
