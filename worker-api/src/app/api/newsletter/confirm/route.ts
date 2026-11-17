import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { sendEmail } from "@/lib/integrations/email-service";
import { buildWelcomeSubscriberHtml } from "@/lib/newsletter/email-templates";
import { confirmSubscriberByToken } from "@/lib/newsletter/newsletter-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const frontendUrl = process.env.FRONTEND_URL || "https://amankayare.com";

  if (!token) {
    return Response.redirect(`${frontendUrl}/blogs?newsletter=invalid_token`, 302);
  }

  try {
    const db = await getDatabaseProvider();
    const confirmedSubscriber = await confirmSubscriberByToken(db, token);

    if (!confirmedSubscriber) {
      return Response.redirect(`${frontendUrl}/blogs?newsletter=invalid_or_expired`, 302);
    }

    // Send Welcome email once subscriber is officially confirmed
    const baseUrl = process.env.API_BASE_URL || "https://api.amankayare.com";
    const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
      confirmedSubscriber.unsubscribe_token,
    )}`;

    const welcomeHtml = buildWelcomeSubscriberHtml({
      unsubscribeUrl,
    });

    await sendEmail({
      to: confirmedSubscriber.email,
      subject: "Welcome to Dev47 Insights! 🎉",
      body: welcomeHtml,
      isHtml: true,
    });

    return Response.redirect(`${frontendUrl}/blogs?newsletter=confirmed`, 302);
  } catch (error) {
    console.error("Newsletter confirmation error:", error);
    return Response.redirect(`${frontendUrl}/blogs?newsletter=error`, 302);
  }
}
