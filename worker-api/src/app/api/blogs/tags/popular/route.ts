import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getPopularTags } from "@/lib/blogs/blog-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  try {
    const db = await getDatabaseProvider();
    const result = await getPopularTags(db);
    return jsonResponse(result, 200, request);
  } catch (error) {
    return jsonResponse(
      { error: `Failed to fetch popular tags: ${String(error)}` },
      500,
      request,
    );
  }
}
