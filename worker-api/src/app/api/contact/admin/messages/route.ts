import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  formatContactMessageDto,
  getPaginatedContactMessages,
} from "@/lib/contact/contact-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") ?? "1", 10) || 1;
    const pageSize =
      parseInt(url.searchParams.get("page_size") ?? "10", 10) || 10;
    const search = url.searchParams.get("search") ?? "";
    const rawStatus = url.searchParams.get("status")?.toLowerCase();
    const status =
      rawStatus === "read" || rawStatus === "unread" ? rawStatus : "all";

    const db = await getDatabaseProvider();
    const paginated = await getPaginatedContactMessages(db, {
      page,
      pageSize,
      search,
      status,
    });

    return jsonResponse(
      {
        messages: paginated.messages.map(formatContactMessageDto),
        total: paginated.total,
        page: paginated.page,
        page_size: paginated.pageSize,
        total_pages: paginated.totalPages,
        current_filter: paginated.currentFilter,
        counts: paginated.counts,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Failed to fetch contact messages:", error);
    return jsonResponse({ error: "Failed to fetch contact messages" }, 500, request);
  }
}
