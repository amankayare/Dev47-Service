import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getBlogCategoryById,
  updateBlogCategory,
  deleteBlogCategory,
} from "@/lib/blogs/blog-category-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function PUT(request: Request, context: RouteContext) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const categoryId = parseInt(rawId, 10);
  if (Number.isNaN(categoryId)) {
    return jsonResponse({ error: "Invalid category ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const existing = await getBlogCategoryById(db, categoryId);
  if (!existing) {
    return jsonResponse({ error: "Category not found." }, 404, request);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return jsonResponse({ error: "Category name is required." }, 400, request);
  }

  const duplicateCheck = await db.query<{ id: number }>(
    "SELECT id FROM blog_categories WHERE id != ? AND name = ?",
    [categoryId, name],
  );
  if (duplicateCheck.length > 0) {
    return jsonResponse({ error: "Category name already exists." }, 400, request);
  }

  const updated = await updateBlogCategory(db, categoryId, name);
  return jsonResponse(updated, 200, request);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id: rawId } = await context.params;
  const categoryId = parseInt(rawId, 10);
  if (Number.isNaN(categoryId)) {
    return jsonResponse({ error: "Invalid category ID" }, 400, request);
  }

  const db = await getDatabaseProvider();
  const existing = await getBlogCategoryById(db, categoryId);
  if (!existing) {
    return jsonResponse({ error: "Category not found." }, 404, request);
  }

  await deleteBlogCategory(db, categoryId);
  return new Response(null, {
    status: 204,
  });
}
