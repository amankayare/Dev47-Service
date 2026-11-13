import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { markAllContactMessagesRead } from "@/lib/contact/contact-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function PUT(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    const updatedCount = await markAllContactMessagesRead(db);

    return jsonResponse(
      {
        message: `All ${updatedCount} unread messages marked as read successfully`,
        updated_count: updatedCount,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Mark all messages read failed:", error);
    return jsonResponse({ error: "Failed to mark messages as read" }, 500, request);
  }
}
