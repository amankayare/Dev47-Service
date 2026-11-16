import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getNewsletterBannerSettings } from "@/lib/settings/settings-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await getDatabaseProvider();
    const settings = await getNewsletterBannerSettings(db);
    return jsonResponse(settings, 200, request);
  } catch (error) {
    console.error("Failed to fetch newsletter banner settings:", error);
    return jsonResponse({ error: "Failed to fetch settings" }, 500, request);
  }
}
