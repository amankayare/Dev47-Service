import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool } from "pg";
import { CloudflareD1Provider } from "./cloudflare-d1-provider";
import { PostgresProvider, SqliteProvider } from "./sql-provider";
import type {
  DatabaseProvider,
  HyperdriveBindingLike,
} from "./types";

let nodeProvider: DatabaseProvider | undefined;

export function resetDatabaseProvider(): void {
  nodeProvider = undefined;
}

export async function getDatabaseProvider(): Promise<DatabaseProvider> {
  const backend = (process.env.DATABASE_BACKEND ?? "SQLAlchemy")
    .trim()
    .toLowerCase();

  if (backend === "cloudflare_d1") {
    const { env } = await getCloudflareContext({ async: true });
    if (!env.DB) {
      throw new Error("The Cloudflare D1 binding named DB is not configured.");
    }
    return new CloudflareD1Provider(env.DB);
  }

  if (backend !== "sqlalchemy") {
    throw new Error(
      "DATABASE_BACKEND must be 'cloudflare_d1' or 'SQLAlchemy'.",
    );
  }

  if (!nodeProvider) {
    nodeProvider = await createSqlProvider();
  }
  return nodeProvider;
}

async function createSqlProvider(): Promise<DatabaseProvider> {
  if (process.env.USE_HYPERDRIVE?.trim().toLowerCase() === "true") {
    const { env } = await getCloudflareContext({ async: true });
    const hyperdrive: HyperdriveBindingLike | undefined = env.HYPERDRIVE;
    if (!hyperdrive?.connectionString) {
      throw new Error(
        "USE_HYPERDRIVE=true requires the HYPERDRIVE Worker binding.",
      );
    }
    return new PostgresProvider(
      new Pool({ connectionString: hyperdrive.connectionString, max: 1 }),
    );
  }

  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is required when DATABASE_BACKEND=SQLAlchemy.",
    );
  }

  if (databaseUrl.startsWith("sqlite:///")) {
    let filename = databaseUrl.slice("sqlite:///".length);
    if (!filename) {
      throw new Error("DATABASE_URL must include a SQLite database path.");
    }
    if (process.platform === "win32" && /^\/[a-z]:\//i.test(filename)) {
      filename = filename.slice(1);
    }
    return new SqliteProvider(filename);
  }

  if (
    databaseUrl.startsWith("postgres://") ||
    databaseUrl.startsWith("postgresql://")
  ) {
    return new PostgresProvider(new Pool({ connectionString: databaseUrl }));
  }

  throw new Error(
    "DATABASE_URL must use sqlite:/// or postgresql:// for the SQL provider.",
  );
}
