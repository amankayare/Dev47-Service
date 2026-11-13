import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createContactMessage,
  formatContactMessageDto,
} from "@/lib/contact/contact-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const email = typeof data.email === "string" ? data.email.trim() : "";
    const subject = typeof data.subject === "string" ? data.subject.trim() : "";
    const message = typeof data.message === "string" ? data.message.trim() : "";

    if (!name || !email || !message) {
      return jsonResponse(
        { error: "Name, email, and message are required." },
        400,
        request,
      );
    }

    // Support camelCase preferredContactMethod and snake_case preferred_contact_method
    const rawPreferred =
      data.preferredContactMethod ?? data.preferred_contact_method;
    const preferredContactMethod =
      typeof rawPreferred === "string" ? rawPreferred.trim() : "";

    const phone = typeof data.phone === "string" ? data.phone.trim() : "";

    const db = await getDatabaseProvider();
    const created = await createContactMessage(db, {
      name,
      email,
      subject,
      message,
      phone,
      preferred_contact_method: preferredContactMethod,
    });

    return jsonResponse(formatContactMessageDto(created), 201, request);
  } catch (error) {
    console.error("Create contact message failed:", error);
    return jsonResponse({ error: "Failed to send contact message" }, 500, request);
  }
}
