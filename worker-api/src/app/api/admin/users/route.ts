import { requireAdmin } from "@/lib/auth/jwt";
import { formatUserDto } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getPaginatedUsers } from "@/lib/admin/admin-repository";

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
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const pageSize =
      parseInt(url.searchParams.get("page_size") ?? "10", 10) || 10;
    const search = url.searchParams.get("search") ?? "";

    const db = await getDatabaseProvider();
    const paginated = await getPaginatedUsers(db, page, pageSize, search);

    return jsonResponse(
      {
        users: paginated.users.map(formatUserDto),
        total: paginated.total,
        page: paginated.page,
        page_size: paginated.pageSize,
        total_pages: paginated.totalPages,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Failed to fetch admin users:", error);
    return jsonResponse({ error: "Failed to fetch users" }, 500, request);
  }
}
