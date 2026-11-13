import { requireAdmin, authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getBlogById,
  updateBlog,
  deleteBlog,
  type UpdateBlogInput,
} from "@/lib/blogs/blog-repository";

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
  const blog = await getBlogById(db, blogId);
  if (!blog) {
    return jsonResponse({ error: "Blog not found" }, 404, request);
  }

  return jsonResponse(blog, 200, request);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const blogId = parseInt(rawId, 10);
  if (Number.isNaN(blogId)) {
    return jsonResponse({ error: "Invalid blog ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const existing = await getBlogById(db, blogId);
  if (!existing) {
    return jsonResponse({ error: "Blog not found" }, 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ errors: "Invalid JSON body" }, 400, request);
  }

  if (body.author !== undefined) {
    const authorObj = body.author;
    if (
      !authorObj ||
      typeof authorObj !== "object" ||
      typeof (authorObj as Record<string, unknown>).name !== "string" ||
      !(authorObj as Record<string, unknown>).name
    ) {
      return jsonResponse(
        { error: "Author is required for update and must have a name." },
        400,
        request,
      );
    }
  }

  if (body.quick_links !== undefined && body.quick_links !== null && !Array.isArray(body.quick_links)) {
    return jsonResponse(
      { error: "quick_links must be an array." },
      400,
      request,
    );
  }

  try {
    const input: UpdateBlogInput = {};
    if (typeof body.title === "string") input.title = body.title;
    if (body.excerpt !== undefined) input.excerpt = typeof body.excerpt === "string" ? body.excerpt : "";
    if (typeof body.content === "string") input.content = body.content;
    if (body.cover_image !== undefined) input.cover_image = typeof body.cover_image === "string" ? body.cover_image : "";
    if (body.date !== undefined) input.date = typeof body.date === "string" ? body.date : null;
    if (body.reading_time !== undefined) input.reading_time = body.reading_time !== null ? Number(body.reading_time) : null;
    if (body.featured !== undefined) input.featured = body.featured as boolean | string;
    if (body.is_visible !== undefined) input.is_visible = body.is_visible as boolean | string;
    if (body.quick_links !== undefined) input.quick_links = body.quick_links as Array<{ title: string; url: string }> | null;
    if (body.category_id !== undefined) input.category_id = Number(body.category_id);
    if (body.author !== undefined) input.author = body.author as { id?: number; name: string };
    if (body.tags !== undefined) {
      input.tags = Array.isArray(body.tags) ? (body.tags as Array<string | { id?: number; name?: string }>) : [];
    }

    const updated = await updateBlog(db, blogId, input);
    return jsonResponse(updated, 200, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Category not found.") {
      return jsonResponse({ error: "Category not found." }, 400, request);
    }
    return jsonResponse({ errors: message }, 400, request);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
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
  const existing = await getBlogById(db, blogId);
  if (!existing) {
    return jsonResponse({ error: "Blog not found" }, 404, request);
  }

  try {
    await deleteBlog(db, blogId);
    return new Response(null, {
      status: 204,
    });
  } catch (error) {
    return jsonResponse({ error: "Failed to delete blog" }, 500, request);
  }
}
