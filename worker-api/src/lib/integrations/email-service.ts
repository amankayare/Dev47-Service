import { getCloudflareContext } from "@opennextjs/cloudflare";

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  let emailServiceUrl = process.env.EMAIL_SERVICE_URL;
  let apiKey = process.env.EMAIL_SERVICE_API_KEY;
  let emailServiceBinding: any = null;

  try {
    const ctx = await getCloudflareContext({ async: true });
    if (ctx?.env) {
      const cfEnv = ctx.env as any;
      if (cfEnv.EMAIL_SERVICE) {
        emailServiceBinding = cfEnv.EMAIL_SERVICE;
      }
      if (cfEnv.EMAIL_SERVICE_URL) {
        emailServiceUrl = cfEnv.EMAIL_SERVICE_URL;
      }
      if (cfEnv.EMAIL_SERVICE_API_KEY) {
        apiKey = cfEnv.EMAIL_SERVICE_API_KEY;
      }
    }
  } catch {
    // Fall back to process.env if not running inside Cloudflare runtime context
  }

  const payload = {
    to: params.to,
    subject: params.subject,
    body: params.body,
    isHtml: params.isHtml ?? true,
    immediate: true, // Use immediate mode for transactional password resets
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-API-Key"] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    let response: Response;

    // Prefer Cloudflare Service Binding if available (avoids cross-worker 1042 fetch restrictions)
    if (emailServiceBinding && typeof emailServiceBinding.fetch === "function") {
      console.log("Email Service attempt via Service Binding");
      response = await emailServiceBinding.fetch("https://email-service-worker/api/email/send", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } else {
      if (!emailServiceUrl) {
        console.warn("EMAIL_SERVICE_URL not configured. Email not sent.");
        return false;
      }

      console.log("Email Service attempt via URL fetch:", { emailServiceUrl, hasKey: Boolean(apiKey) });
      response = await fetch(emailServiceUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    }
    clearTimeout(timeout);

    if (!response.ok && response.status !== 202) {
      const errorText = await response.text();
      console.error("Email service response error:", response.status, errorText);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to connect to Email Microservice:", error);
    return false;
  }
}
