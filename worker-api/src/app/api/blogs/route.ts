import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  listVisibleBlogs,
  createBlog,
  type CreateBlogInput,
} from "@/lib/blogs/blog-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const db = await getDatabaseProvider();
  const blogs = await listVisibleBlogs(db);
  return jsonResponse(blogs, 200, request);
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
    return jsonResponse({ errors: "Invalid JSON body" }, 400, request);
  }

  const title = typeof body.title === "string" ? body.title.trim() : "";
  if (!title) {
    return jsonResponse({ errors: "Title is required" }, 400, request);
  }

  const content = typeof body.content === "string" ? body.content : "";
  if (!content) {
    return jsonResponse({ errors: "Content is required" }, 400, request);
  }

  const authorObj = body.author;
  if (
    !authorObj ||
    typeof authorObj !== "object" ||
    typeof (authorObj as Record<string, unknown>).name !== "string" ||
    !(authorObj as Record<string, unknown>).name
  ) {
    return jsonResponse(
      { error: "Author is required and must have a name." },
      400,
      request,
    );
  }

  const categoryId = Number(body.category_id);
  if (!body.category_id || Number.isNaN(categoryId)) {
    return jsonResponse({ error: "Category is required." }, 400, request);
  }

  if (body.quick_links !== undefined && body.quick_links !== null && !Array.isArray(body.quick_links)) {
    return jsonResponse({ error: "quick_links must be an array." }, 400, request);
  }

  const db = await getDatabaseProvider();

  try {
    const input: CreateBlogInput = {
      title,
      excerpt: typeof body.excerpt === "string" ? body.excerpt : "",
      content,
      cover_image: typeof body.cover_image === "string" ? body.cover_image : "",
      date: typeof body.date === "string" ? body.date : undefined,
      reading_time: body.reading_time !== undefined && body.reading_time !== null ? Number(body.reading_time) : null,
      featured: body.featured as boolean | string | undefined,
      is_visible: body.is_visible as boolean | string | undefined,
      quick_links: body.quick_links as Array<{ title: string; url: string }> | undefined,
      category_id: categoryId,
      author: authorObj as { id?: number; name: string },
      tags: Array.isArray(body.tags) ? (body.tags as Array<string | { id?: number; name?: string }>) : [],
    };

    const blog = await createBlog(db, input);
    return jsonResponse(blog, 201, request);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Category not found.") {
      return jsonResponse({ error: "Category not found." }, 400, request);
    }
    return jsonResponse({ errors: message }, 400, request);
  }
}
