import { afterEach, describe, expect, it, vi } from "vitest";
import { getDatabaseProvider, resetDatabaseProvider } from ".";

afterEach(() => {
  resetDatabaseProvider();
  vi.unstubAllEnvs();
});

describe("database provider selection", () => {
  it("uses the SQL provider selected through DATABASE_BACKEND and DATABASE_URL", async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("DATABASE_URL", "sqlite:///:memory:");

    const provider = await getDatabaseProvider();
    await provider.execute(
      "CREATE TABLE provider_probe (value INTEGER NOT NULL)",
    );
    await provider.execute("INSERT INTO provider_probe (value) VALUES (?)", [
      47,
    ]);

    await expect(
      provider.query<{ value: number }>("SELECT value FROM provider_probe"),
    ).resolves.toEqual([{ value: 47 }]);
  });

  it("rejects unsupported database backends", async () => {
    vi.stubEnv("DATABASE_BACKEND", "unsupported");

    await expect(getDatabaseProvider()).rejects.toThrow(
      "DATABASE_BACKEND must be 'cloudflare_d1' or 'SQLAlchemy'.",
    );
  });
});
