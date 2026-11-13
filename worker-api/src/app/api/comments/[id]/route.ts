import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getCommentById,
  updateComment,
  deleteCommentTree,
} from "@/lib/blogs/comment-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const commentId = parseInt(rawId, 10);
  if (Number.isNaN(commentId)) {
    return jsonResponse({ error: "Invalid comment ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const comment = await getCommentById(db, commentId);
  if (!comment) {
    return jsonResponse({ error: "Comment not found" }, 404, request);
  }

  if (comment.author_id !== auth.user.user_id && !auth.user.is_admin) {
    return jsonResponse(
      { error: "Not authorized to edit this comment" },
      403,
      request,
    );
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

  try {
    await updateComment(db, commentId, content);
    return jsonResponse(
      { message: "Comment updated successfully" },
      200,
      request,
    );
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500, request);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const commentId = parseInt(rawId, 10);
  if (Number.isNaN(commentId)) {
    return jsonResponse({ error: "Invalid comment ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const comment = await getCommentById(db, commentId);
  if (!comment) {
    return jsonResponse({ error: "Comment not found" }, 404, request);
  }

  if (comment.author_id !== auth.user.user_id && !auth.user.is_admin) {
    return jsonResponse(
      { error: "Not authorized to delete this comment" },
      403,
      request,
    );
  }

  try {
    await deleteCommentTree(db, commentId);
    return jsonResponse(
      { message: "Comment deleted successfully" },
      200,
      request,
    );
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500, request);
  }
}
