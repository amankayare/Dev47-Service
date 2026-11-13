import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getPopularTagsSimple } from "@/lib/blogs/blog-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  try {
    const db = await getDatabaseProvider();
    const result = await getPopularTagsSimple(db);
    return jsonResponse(result, 200, request);
  } catch (error) {
    return jsonResponse(
      { error: `Simple popular tags failed: ${String(error)}` },
      500,
      request,
    );
  }
}
