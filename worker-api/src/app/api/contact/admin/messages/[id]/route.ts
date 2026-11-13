import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  deleteContactMessage,
  getContactMessageById,
} from "@/lib/contact/contact-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const messageId = parseInt(id, 10);
  if (Number.isNaN(messageId)) {
    return jsonResponse({ error: "Message not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getContactMessageById(db, messageId);
    if (!existing) {
      return jsonResponse({ error: "Message not found" }, 404, request);
    }

    await deleteContactMessage(db, messageId);
    return jsonResponse(
      { message: "Contact message deleted successfully" },
      200,
      request,
    );
  } catch (error) {
    console.error("Delete contact message failed:", error);
    return jsonResponse({ error: "Failed to delete message" }, 500, request);
  }
}
