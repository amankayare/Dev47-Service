export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const emailServiceUrl = process.env.EMAIL_SERVICE_URL;
  const apiKey = process.env.EMAIL_SERVICE_API_KEY;

  if (!emailServiceUrl) {
    console.warn("EMAIL_SERVICE_URL not configured. Email not sent.");
    return false;
  }

  const payload = {
    to: params.to,
    subject: params.subject,
    body: params.body,
    isHtml: params.isHtml ?? true,
  };

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["X-Api-Key"] = apiKey;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(emailServiceUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.status === 200 || response.status === 202;
  } catch (error) {
    console.error("Failed to connect to Email Microservice:", error);
    return false;
  }
}
