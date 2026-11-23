import { requireWriterOrAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { listBlogsAdmin } from "@/lib/blogs/blog-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const auth = await requireWriterOrAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
  const pageSize = parseInt(url.searchParams.get("page_size") ?? "5", 10) || 5;
  const search = url.searchParams.get("search") ?? "";
  const status = url.searchParams.get("status") ?? "all";

  // Admin sees all blogs; writers only see their own blogs
  const isAdmin = Boolean(auth.user.is_admin || auth.user.role === "admin");
  const userId = isAdmin ? undefined : (auth.user.user_id ?? undefined);

  const db = await getDatabaseProvider();
  try {
    const result = await listBlogsAdmin(db, {
      page,
      pageSize,
      search,
      status,
      userId,
    });
    return jsonResponse(result, 200, request);
  } catch (error) {
    return jsonResponse({ error: String(error) }, 500, request);
  }
}
