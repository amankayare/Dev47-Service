import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import { sendEmail } from "@/lib/integrations/email-service";
import { buildBroadcastNewsletterHtml } from "@/lib/newsletter/email-templates";
import type { NewsletterSubscriber } from "@/lib/newsletter/newsletter-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const body = await parseJsonBody<{
      subject?: string;
      title?: string;
      contentHtml?: string;
      target?: "active" | "all";
    }>(request);

    const subject = body?.subject?.trim();
    const title = body?.title?.trim() || subject;
    const contentHtml = body?.contentHtml?.trim();
    const target = body?.target || "active";

    if (!subject || !contentHtml) {
      return jsonResponse(
        { error: "Subject and message content are required." },
        400,
        request,
      );
    }

    const db = await getDatabaseProvider();

    // Query target recipients
    const query =
      target === "all"
        ? "SELECT email, unsubscribe_token FROM newsletter_subscribers WHERE status != 'unsubscribed'"
        : "SELECT email, unsubscribe_token FROM newsletter_subscribers WHERE status = 'active'";

    const recipients = await db.query<Pick<NewsletterSubscriber, "email" | "unsubscribe_token">>(query);

    if (recipients.length === 0) {
      return jsonResponse(
        {
          success: true,
          total: 0,
          sent: 0,
          failed: 0,
          message: "No active subscribers found to broadcast to.",
        },
        200,
        request,
      );
    }

    const baseUrl = process.env.API_BASE_URL || "https://api.amankayare.com";
    let sentCount = 0;
    let failedCount = 0;

    // Send personalized broadcast with individual unsubscribe link to each subscriber
    for (const sub of recipients) {
      const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(
        sub.unsubscribe_token,
      )}`;

      const html = buildBroadcastNewsletterHtml({
        title: title || subject,
        contentHtml,
        unsubscribeUrl,
      });

      const success = await sendEmail({
        to: sub.email,
        subject,
        body: html,
        isHtml: true,
      });

      if (success) {
        sentCount++;
      } else {
        failedCount++;
      }
    }

    return jsonResponse(
      {
        success: true,
        total: recipients.length,
        sent: sentCount,
        failed: failedCount,
        message: `Newsletter broadcast dispatched to ${sentCount} recipient(s).`,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Broadcast newsletter error:", error);
    return jsonResponse(
      { error: "Failed to broadcast newsletter. Please try again." },
      500,
      request,
    );
  }
}
