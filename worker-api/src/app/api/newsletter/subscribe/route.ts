import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import { sendEmail } from "@/lib/integrations/email-service";
import { buildDoubleOptInConfirmationHtml } from "@/lib/newsletter/email-templates";
import { createOrReactivateSubscriber } from "@/lib/newsletter/newsletter-repository";

export const dynamic = "force-dynamic";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody<{ email?: string; source?: string }>(request);
    const email = body?.email?.trim().toLowerCase();
    const source = body?.source?.trim() || "blog_banner";

    if (!email || !EMAIL_REGEX.test(email)) {
      return jsonResponse(
        { error: "A valid email address is required." },
        400,
        request,
      );
    }

    const db = await getDatabaseProvider();
    const result = await createOrReactivateSubscriber(db, email, source);

    if (result.alreadyActive) {
      return jsonResponse(
        {
          success: true,
          status: "already_subscribed",
          message: "You're already subscribed to Dev47 Future Insights!",
        },
        200,
        request,
      );
    }

    const token = result.subscriber.confirmation_token;
    const unsubToken = result.subscriber.unsubscribe_token;

    // Build URL links
    const baseUrl = process.env.API_BASE_URL || "https://api.amankayare.com";
    const confirmationUrl = `${baseUrl}/api/newsletter/confirm?token=${encodeURIComponent(token || "")}`;
    const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(unsubToken || "")}`;

    // Send confirmation verification email
    const emailHtml = buildDoubleOptInConfirmationHtml({
      email,
      confirmationUrl,
      unsubscribeUrl,
    });

    const emailSent = await sendEmail({
      to: email,
      subject: "Confirm your subscription · Dev47 Future Insights",
      body: emailHtml,
      isHtml: true,
    });

    if (!emailSent) {
      console.warn("Failed to dispatch confirmation email to", email);
    }

    return jsonResponse(
      {
        success: true,
        status: "pending_confirmation",
        message: "Almost there! Please check your inbox to confirm your subscription.",
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Newsletter subscription error:", error);
    return jsonResponse(
      { error: "Failed to process subscription. Please try again later." },
      500,
      request,
    );
  }
}
