import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getAdminDashboardStats } from "@/lib/admin/admin-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    const stats = await getAdminDashboardStats(db);
    return jsonResponse(stats, 200, request);
  } catch (error) {
    console.error("Failed to fetch admin dashboard stats:", error);
    return jsonResponse({ error: "Failed to fetch dashboard stats" }, 500, request);
  }
}
