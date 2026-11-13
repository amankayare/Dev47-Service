import { requireAdmin } from "@/lib/auth/jwt";
import { findUserById, formatUserDto } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { toggleUserAdmin } from "@/lib/admin/admin-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await findUserById(db, userId);
    if (!existing) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    const updated = await toggleUserAdmin(db, userId);
    if (!updated) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    return jsonResponse(
      {
        message: "User admin status updated",
        user: formatUserDto(updated),
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Toggle user admin failed:", error);
    return jsonResponse({ error: "Failed to update user admin status" }, 500, request);
  }
}
