import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { unsubscribeByToken } from "@/lib/newsletter/newsletter-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const frontendUrl = process.env.FRONTEND_URL || "https://amankayare.com";

  if (!token) {
    return Response.redirect(`${frontendUrl}/blogs?newsletter=unsub_invalid`, 302);
  }

  try {
    const db = await getDatabaseProvider();
    const unsubscribed = await unsubscribeByToken(db, token);

    if (!unsubscribed) {
      return Response.redirect(`${frontendUrl}/blogs?newsletter=unsub_not_found`, 302);
    }

    return Response.redirect(`${frontendUrl}/blogs?newsletter=unsubscribed`, 302);
  } catch (error) {
    console.error("Newsletter unsubscribe error:", error);
    return Response.redirect(`${frontendUrl}/blogs?newsletter=error`, 302);
  }
}
