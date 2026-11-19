import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getUserBookmarkIds } from "@/lib/blogs/bookmark-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated || auth.user.user_id === null || auth.user.user_id === undefined) {
    // Return empty array for guests or invalid token instead of error
    return jsonResponse({ bookmark_ids: [] }, 200, request);
  }

  try {
    const db = await getDatabaseProvider();
    const ids = await getUserBookmarkIds(db, auth.user.user_id);
    return jsonResponse({ bookmark_ids: ids }, 200, request);
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to fetch bookmark IDs", bookmark_ids: [] },
      500,
      request,
    );
  }
}
