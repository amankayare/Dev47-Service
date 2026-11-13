export type SqlValue = string | number | boolean | null | Uint8Array;

export interface SqlStatement {
  sql: string;
  params?: readonly SqlValue[];
  returnsRows?: boolean;
}

export interface QueryResult<T = Record<string, unknown>> {
  rows: T[];
  changes: number;
  lastInsertRowId: number | null;
}

export interface DatabaseProvider {
  query<T extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<T[]>;
  execute(
    sql: string,
    params?: readonly SqlValue[],
  ): Promise<QueryResult>;
  batch(statements: readonly SqlStatement[]): Promise<QueryResult[]>;
  healthCheck(): Promise<void>;
}

export interface D1ResultLike<T = Record<string, unknown>> {
  success: boolean;
  error?: string;
  results?: T[];
  meta?: {
    changes?: number;
    last_row_id?: number;
  };
}

export interface D1PreparedStatementLike {
  bind(...values: SqlValue[]): D1PreparedStatementLike;
  all<T = Record<string, unknown>>(): Promise<D1ResultLike<T>>;
  run(): Promise<D1ResultLike>;
}

export interface D1BindingLike {
  prepare(sql: string): D1PreparedStatementLike;
  batch(
    statements: D1PreparedStatementLike[],
  ): Promise<D1ResultLike[]>;
}

export interface HyperdriveBindingLike {
  connectionString: string;
}

export interface WorkerBindings {
  DB: D1BindingLike;
  HYPERDRIVE?: HyperdriveBindingLike;
}
