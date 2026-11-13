import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getBlogById,
  getRelatedBlogs,
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

  const related = await getRelatedBlogs(db, blogId);
  return jsonResponse(related, 200, request);
}
