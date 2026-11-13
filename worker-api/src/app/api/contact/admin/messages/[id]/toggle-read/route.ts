import { requireAdmin } from "@/lib/auth/jwt";
import { formatIsoDate } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  getContactMessageById,
  toggleContactMessageRead,
} from "@/lib/contact/contact-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function PUT(
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

    const result = await toggleContactMessageRead(db, messageId);
    if (!result) {
      return jsonResponse({ error: "Message not found" }, 404, request);
    }

    return jsonResponse(
      {
        message: result.statusMessage,
        is_read: Boolean(result.message.is_read),
        read_at: formatIsoDate(result.message.read_at),
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Toggle message read failed:", error);
    return jsonResponse(
      { error: "Failed to toggle message read status" },
      500,
      request,
    );
  }
}
