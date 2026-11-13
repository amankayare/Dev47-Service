import { afterEach, describe, expect, it } from "vitest";
import { SqliteProvider, toPostgresPlaceholders } from "./sql-provider";

const providers: SqliteProvider[] = [];

afterEach(() => {
  for (const provider of providers.splice(0)) {
    provider.close();
  }
});

describe("SqliteProvider", () => {
  it("supports query, execute and atomic batch operations", async () => {
    const provider = new SqliteProvider(":memory:");
    providers.push(provider);

    await provider.execute(
      "CREATE TABLE sample (id INTEGER PRIMARY KEY, value TEXT NOT NULL)",
    );
    const result = await provider.execute(
      "INSERT INTO sample (value) VALUES (?)",
      ["first"],
    );
    expect(result.changes).toBe(1);

    const rows = await provider.query<{ id: number; value: string }>(
      "SELECT id, value FROM sample WHERE value = ?",
      ["first"],
    );
    expect(rows).toEqual([{ id: 1, value: "first" }]);

    const batch = await provider.batch([
      {
        sql: "INSERT INTO sample (value) VALUES (?)",
        params: ["second"],
      },
      {
        sql: "SELECT value FROM sample WHERE id = ?",
        params: [2],
        returnsRows: true,
      },
    ]);
    expect(batch[0].changes).toBe(1);
    expect(batch[1].rows).toEqual([{ value: "second" }]);
  });
});

describe("toPostgresPlaceholders", () => {
  it("converts positional placeholders without changing quoted text or comments", () => {
    expect(
      toPostgresPlaceholders(
        "SELECT '?' AS literal, value FROM sample WHERE id = ? -- ?\nAND name = ?",
      ),
    ).toBe(
      "SELECT '?' AS literal, value FROM sample WHERE id = $1 -- ?\nAND name = $2",
    );
  });
});
