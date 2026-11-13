import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  listBlogCategories,
  getBlogCategoryByName,
  createBlogCategory,
} from "@/lib/blogs/blog-category-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const db = await getDatabaseProvider();
  const categories = await listBlogCategories(db);
  return jsonResponse(categories, 200, request);
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
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

  const db = await getDatabaseProvider();
  const existing = await getBlogCategoryByName(db, name);
  if (existing) {
    return jsonResponse({ error: "Category already exists." }, 400, request);
  }

  const category = await createBlogCategory(db, name);
  return jsonResponse(category, 201, request);
}
