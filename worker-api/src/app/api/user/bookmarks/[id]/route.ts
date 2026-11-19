import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { removeBookmark } from "@/lib/blogs/bookmark-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  const { id: rawId } = await context.params;
  const blogId = parseInt(rawId, 10);
  if (Number.isNaN(blogId)) {
    return jsonResponse({ error: "Invalid blog ID" }, 400, request);
  }

  try {
    const db = await getDatabaseProvider();
    await removeBookmark(db, auth.user.user_id, blogId);
    return jsonResponse(
      { success: true, is_bookmarked: false, blog_id: blogId },
      200,
      request,
    );
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to remove bookmark" },
      500,
      request,
    );
  }
}
