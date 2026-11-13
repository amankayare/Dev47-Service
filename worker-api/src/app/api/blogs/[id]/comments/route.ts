import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getCommentsByBlogId,
  createComment,
} from "@/lib/blogs/comment-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request, context: RouteContext) {
  const { id: rawId } = await context.params;
  const blogId = parseInt(rawId, 10);
  if (Number.isNaN(blogId)) {
    return jsonResponse({ error: "Invalid blog ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const blogCheck = await db.query<{ id: number }>(
    "SELECT id FROM blogs WHERE id = ?",
    [blogId],
  );
  if (blogCheck.length === 0) {
    return jsonResponse({ error: "Blog not found" }, 404, request);
  }

  try {
    const comments = await getCommentsByBlogId(db, blogId);
    return jsonResponse(comments, 200, request);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500, request);
  }
}

export async function POST(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const blogId = parseInt(rawId, 10);
  if (Number.isNaN(blogId)) {
    return jsonResponse({ error: "Invalid blog ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const userCheck = await db.query<{ id: number; username: string; is_admin: number }>(
    "SELECT id, username, is_admin FROM users WHERE id = ?",
    [auth.user.user_id],
  );
  if (userCheck.length === 0) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  const blogCheck = await db.query<{ id: number }>(
    "SELECT id FROM blogs WHERE id = ?",
    [blogId],
  );
  if (blogCheck.length === 0) {
    return jsonResponse({ error: "Blog not found" }, 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Content is required" }, 400, request);
  }

  if (!body || typeof body.content !== "string") {
    return jsonResponse({ error: "Content is required" }, 400, request);
  }

  const content = body.content.trim();
  if (content.length < 1) {
    return jsonResponse({ error: "Content cannot be empty" }, 400, request);
  }

  if (content.length > 2000) {
    return jsonResponse(
      { error: "Content too long (max 2000 characters)" },
      400,
      request,
    );
  }

  let parentId: number | null = null;
  if (body.parent_id !== null && body.parent_id !== undefined) {
    const parsedParentId = Number(body.parent_id);
    if (!Number.isNaN(parsedParentId)) {
      const parentComment = await db.query<{ id: number }>(
        "SELECT id FROM comments WHERE id = ? AND blog_id = ?",
        [parsedParentId, blogId],
      );
      if (parentComment.length === 0) {
        return jsonResponse({ error: "Parent comment not found" }, 404, request);
      }
      parentId = parsedParentId;
    }
  }

  const userId =
    auth.user.user_id ??
    (typeof auth.user.sub === "number" ? auth.user.sub : Number(auth.user.sub));

  try {
    const created = await createComment(db, {
      blogId,
      authorId: userId,
      content,
      parentId,
    });
    return jsonResponse(created, 201, request);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500, request);
  }
}
