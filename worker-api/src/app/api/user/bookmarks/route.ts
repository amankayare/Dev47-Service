import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getUserBookmarks,
  addBookmark,
} from "@/lib/blogs/bookmark-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const bookmarks = await getUserBookmarks(db, auth.user.user_id);
    return jsonResponse(bookmarks, 200, request);
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to fetch bookmarks" },
      500,
      request,
    );
  }
}

export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  let body: { blog_id?: number };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const blogId = Number(body.blog_id);
  if (!blogId || Number.isNaN(blogId)) {
    return jsonResponse({ error: "Valid blog_id is required" }, 400, request);
  }

  try {
    const db = await getDatabaseProvider();
    await addBookmark(db, auth.user.user_id, blogId);
    return jsonResponse(
      { success: true, is_bookmarked: true, blog_id: blogId },
      200,
      request,
    );
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message || "Failed to add bookmark" },
      500,
      request,
    );
  }
}
