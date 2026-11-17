import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getNewsletterSubscribersList,
  getNewsletterSubscribersStats,
} from "@/lib/newsletter/newsletter-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const url = new URL(request.url);
  const status = url.searchParams.get("status") || "all";

  try {
    const db = await getDatabaseProvider();
    const [subscribers, stats] = await Promise.all([
      getNewsletterSubscribersList(db, status),
      getNewsletterSubscribersStats(db),
    ]);

    return jsonResponse(
      {
        subscribers,
        stats,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Failed to fetch newsletter subscribers:", error);
    return jsonResponse(
      { error: "Failed to fetch newsletter subscribers." },
      500,
      request,
    );
  }
}
