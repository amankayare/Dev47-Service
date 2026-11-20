import { requireAdmin } from "@/lib/auth/jwt";
import { findUserById, formatUserDto } from "@/lib/auth/user-repository";
import { assignUserRole } from "@/lib/admin/admin-repository";
import { sendEmail } from "@/lib/integrations/email-service";
import { buildWriterWelcomeEmailHtml } from "@/lib/auth/email-templates";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

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
  const userId = parseInt(id, 10);
  if (Number.isNaN(userId)) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  const body = await parseJsonBody(request);
  if (!body) {
    return jsonResponse({ error: "Invalid JSON body" }, 400, request);
  }

  const role = typeof body.role === "string" ? body.role.trim().toLowerCase() : "";
  if (!["admin", "writer", "user"].includes(role)) {
    return jsonResponse(
      { error: "Invalid role. Role must be 'admin', 'writer', or 'user'." },
      400,
      request,
    );
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await findUserById(db, userId);
    if (!existing) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    const previousRole = (existing.role || (existing.is_admin ? "admin" : "user")).toLowerCase();
    const updated = await assignUserRole(db, userId, role as "admin" | "writer" | "user");
    if (!updated) {
      return jsonResponse({ error: "Failed to update user role" }, 500, request);
    }

    let emailSent = false;
    // Send welcome email if newly promoted to writer
    if (role === "writer" && previousRole !== "writer") {
      try {
        const welcomeEmail = buildWriterWelcomeEmailHtml({
          username: existing.username,
        });
        emailSent = await sendEmail({
          to: existing.email,
          subject: "Welcome to the Dev47 Writing Team! ✍️",
          body: welcomeEmail,
          isHtml: true,
        });
      } catch (emailErr) {
        console.error("Failed to send writer welcome email:", emailErr);
      }
    }

    return jsonResponse(
      {
        success: true,
        message: role === "writer"
          ? (emailSent
              ? `User assigned as Writer and welcome email sent to ${existing.email}.`
              : "User assigned as Writer.")
          : `User role updated to ${role}.`,
        user: formatUserDto(updated),
        email_sent: emailSent,
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Assign user role failed:", error);
    return jsonResponse({ error: "Failed to update user role" }, 500, request);
  }
}
