import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  getNewsletterBannerSettings,
  updateNewsletterBannerSettings,
  type NewsletterBannerSettings,
} from "@/lib/settings/settings-repository";

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
    const db = await getDatabaseProvider();
    const settings = await getNewsletterBannerSettings(db);
    return jsonResponse(settings, 200, request);
  } catch (error) {
    console.error("Failed to fetch admin newsletter banner settings:", error);
    return jsonResponse({ error: "Failed to fetch settings" }, 500, request);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const body = (await parseJsonBody<Partial<NewsletterBannerSettings>>(request)) ?? {};
    const db = await getDatabaseProvider();
    const updated = await updateNewsletterBannerSettings(db, body);
    return jsonResponse(
      {
        message: "Newsletter banner settings updated successfully",
        settings: updated,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Failed to update newsletter banner settings:", error);
    return jsonResponse({ error: "Failed to update settings" }, 500, request);
  }
}
