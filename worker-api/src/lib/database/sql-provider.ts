import { createRequire } from "node:module";
import { Pool } from "pg";
import type Database from "better-sqlite3";
import type {
  DatabaseProvider,
  QueryResult,
  SqlStatement,
  SqlValue,
} from "./types";

function normalizeSqliteParams(params: readonly SqlValue[]): unknown[] {
  return params.map((p) => (typeof p === "boolean" ? (p ? 1 : 0) : p));
}

export class SqliteProvider implements DatabaseProvider {
  private readonly database: Database.Database;

  constructor(filename: string) {
    const require = createRequire(import.meta.url);
    const driverName = ["better", "sqlite3"].join("-");
    const DatabaseConstructor = require(driverName) as typeof Database;
    this.database = new DatabaseConstructor(filename);
  }

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<T[]> {
    return this.database.prepare(sql).all(...normalizeSqliteParams(params)) as T[];
  }

  async execute(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<QueryResult> {
    const statement = this.database.prepare(sql);
    const normalized = normalizeSqliteParams(params);
    if (statement.reader) {
      return {
        rows: statement.all(...normalized) as Record<string, unknown>[],
        changes: 0,
        lastInsertRowId: null,
      };
    }
    const result = statement.run(...normalized);
    return {
      rows: [],
      changes: result.changes,
      lastInsertRowId: Number(result.lastInsertRowid),
    };
  }

  async batch(statements: readonly SqlStatement[]): Promise<QueryResult[]> {
    const apply = this.database.transaction(() =>
      statements.map(({ sql, params = [], returnsRows = false }) => {
        const statement = this.database.prepare(sql);
        const normalized = normalizeSqliteParams(params);
        if (returnsRows) {
          return {
            rows: statement.all(...normalized) as Record<string, unknown>[],
            changes: 0,
            lastInsertRowId: null,
          };
        }
        const result = statement.run(...normalized);
        return {
          rows: [],
          changes: result.changes,
          lastInsertRowId: Number(result.lastInsertRowid),
        };
      }),
    );
    return apply();
  }

  async healthCheck(): Promise<void> {
    await this.query("SELECT 1 AS ok");
  }

  close(): void {
    this.database.close();
  }
}

export class PostgresProvider implements DatabaseProvider {
  constructor(private readonly pool: Pool) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<T[]> {
    const result = await this.pool.query<T>(toPostgresPlaceholders(sql), [...params]);
    return result.rows;
  }

  async execute(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<QueryResult> {
    const result = await this.pool.query(toPostgresPlaceholders(sql), [...params]);
    return {
      rows: result.rows,
      changes: result.rowCount ?? 0,
      lastInsertRowId: null,
    };
  }

  async batch(statements: readonly SqlStatement[]): Promise<QueryResult[]> {
    if (statements.length === 0) {
      return [];
    }

    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const results: QueryResult[] = [];
      for (const { sql, params = [] } of statements) {
        const result = await client.query(
          toPostgresPlaceholders(sql),
          [...params],
        );
        results.push({
          rows: result.rows,
          changes: result.rowCount ?? 0,
          lastInsertRowId: null,
        });
      }
      await client.query("COMMIT");
      return results;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<void> {
    await this.query("SELECT 1 AS ok");
  }
}

export function toPostgresPlaceholders(sql: string): string {
  let output = "";
  let parameterIndex = 0;
  let quote: "'" | '"' | "`" | "]" | null = null;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const next = sql[index + 1];

    if (lineComment) {
      output += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      output += char;
      if (char === "*" && next === "/") {
        output += next;
        index += 1;
        blockComment = false;
      }
      continue;
    }
    if (quote) {
      output += char;
      if (char === quote) {
        if (next === quote && quote !== "]") {
          output += next;
          index += 1;
        } else {
          quote = null;
        }
      }
      continue;
    }

    if (char === "-" && next === "-") {
      output += "--";
      index += 1;
      lineComment = true;
    } else if (char === "/" && next === "*") {
      output += "/*";
      index += 1;
      blockComment = true;
    } else if (char === "'" || char === '"' || char === "`") {
      quote = char;
      output += char;
    } else if (char === "[") {
      quote = "]";
      output += char;
    } else if (char === "?") {
      parameterIndex += 1;
      output += `$${parameterIndex}`;
    } else {
      output += char;
    }
  }

  return output;
}
