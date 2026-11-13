import { getDatabaseProvider } from "@/lib/database";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const database = await getDatabaseProvider();
    await database.healthCheck();
    return Response.json({ status: "ok" });
  } catch (error) {
    console.error("Database health check failed.", error);
    return Response.json(
      { status: "error", message: "Database unavailable" },
      { status: 503 },
    );
  }
}
