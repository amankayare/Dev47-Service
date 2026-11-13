import { authenticateRequest } from "@/lib/auth/jwt";
import { findUserById, formatUserDto } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const user = await findUserById(db, auth.user.user_id);

    if (!user) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    return jsonResponse({ user: formatUserDto(user) }, 200, request);
  } catch (error) {
    console.error("Failed to fetch current user:", error);
    return jsonResponse({ error: "Failed to fetch user" }, 500, request);
  }
}
