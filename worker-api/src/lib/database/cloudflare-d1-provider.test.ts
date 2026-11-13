import { describe, expect, it } from "vitest";
import { CloudflareD1Provider } from "./cloudflare-d1-provider";
import type {
  D1BindingLike,
  D1PreparedStatementLike,
  SqlValue,
} from "./types";

describe("CloudflareD1Provider", () => {
  it("uses bound prepared statements and returns rows", async () => {
    const calls: { sql: string; params: SqlValue[] }[] = [];
    const binding = createBinding(calls);
    const provider = new CloudflareD1Provider(binding);

    const rows = await provider.query<{ id: number }>(
      "SELECT id FROM projects WHERE id = ?",
      [7],
    );

    expect(rows).toEqual([{ id: 7 }]);
    expect(calls).toEqual([
      { sql: "SELECT id FROM projects WHERE id = ?", params: [7] },
    ]);
  });

  it("rejects failed D1 results explicitly", async () => {
    const binding = createBinding([], false);
    const provider = new CloudflareD1Provider(binding);

    await expect(provider.query("SELECT 1")).rejects.toThrow(
      "Cloudflare D1 query failed: simulated failure",
    );
  });

  it("uses D1 batch for a set of statements", async () => {
    const calls: { sql: string; params: SqlValue[] }[] = [];
    const provider = new CloudflareD1Provider(createBinding(calls));

    const results = await provider.batch([
      { sql: "INSERT INTO projects (id) VALUES (?)", params: [8] },
      { sql: "UPDATE projects SET id = ? WHERE id = ?", params: [9, 8] },
    ]);

    expect(results).toHaveLength(2);
    expect(calls).toEqual([
      { sql: "INSERT INTO projects (id) VALUES (?)", params: [8] },
      { sql: "UPDATE projects SET id = ? WHERE id = ?", params: [9, 8] },
    ]);
  });
});

function createBinding(
  calls: { sql: string; params: SqlValue[] }[],
  success = true,
): D1BindingLike {
  return {
    prepare(sql: string): D1PreparedStatementLike {
      let params: SqlValue[] = [];
      const statement: D1PreparedStatementLike = {
        bind(...values) {
          params = values;
          return statement;
        },
        async all<T>() {
          calls.push({ sql, params });
          return {
            success,
            error: success ? undefined : "simulated failure",
            results: success ? ([{ id: 7 }] as T[]) : [],
          };
        },
        async run() {
          calls.push({ sql, params });
          return { success, error: success ? undefined : "simulated failure" };
        },
      };
      return statement;
    },
    async batch(statements) {
      return Promise.all(
        statements.map(async (statement) => {
          return statement.run();
        }),
      );
    },
  };
}
