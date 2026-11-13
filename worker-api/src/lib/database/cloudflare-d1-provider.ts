import type {
  D1BindingLike,
  DatabaseProvider,
  QueryResult,
  SqlStatement,
  SqlValue,
} from "./types";

export class CloudflareD1Provider implements DatabaseProvider {
  constructor(private readonly binding: D1BindingLike) {}

  async query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<T[]> {
    const result = await this.binding.prepare(sql).bind(...params).all<T>();
    this.assertSuccess(result.success, result.error);
    return result.results ?? [];
  }

  async execute(
    sql: string,
    params: readonly SqlValue[] = [],
  ): Promise<QueryResult> {
    const result = await this.binding.prepare(sql).bind(...params).run();
    this.assertSuccess(result.success, result.error);
    return {
      rows: result.results ?? [],
      changes: result.meta?.changes ?? 0,
      lastInsertRowId: result.meta?.last_row_id ?? null,
    };
  }

  async batch(statements: readonly SqlStatement[]): Promise<QueryResult[]> {
    if (statements.length === 0) {
      return [];
    }

    const prepared = statements.map(({ sql, params = [] }) =>
      this.binding.prepare(sql).bind(...params),
    );
    const results = await this.binding.batch(prepared);

    if (results.length !== statements.length) {
      throw new Error("D1 returned an unexpected batch result count.");
    }

    return results.map((result) => {
      this.assertSuccess(result.success, result.error);
      return {
        rows: result.results ?? [],
        changes: result.meta?.changes ?? 0,
        lastInsertRowId: result.meta?.last_row_id ?? null,
      };
    });
  }

  async healthCheck(): Promise<void> {
    await this.query("SELECT 1 AS ok");
  }

  private assertSuccess(success: boolean, error?: string): void {
    if (!success) {
      throw new Error(`Cloudflare D1 query failed: ${error ?? "unknown error"}`);
    }
  }
}
