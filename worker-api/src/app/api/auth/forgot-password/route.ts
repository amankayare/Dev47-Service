import crypto from "node:crypto";
import { findUserByEmail, setUserResetToken } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import { sendEmail } from "@/lib/integrations/email-service";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const data = await parseJsonBody<{ email?: string }>(request);
    const email = data?.email?.trim();

    if (!email) {
      return jsonResponse({ error: "Email is required" }, 400, request);
    }

    const db = await getDatabaseProvider();
    const user = await findUserByEmail(db, email);

    if (!user) {
      // For security, do not reveal if a user exists
      return jsonResponse(
        {
          message:
            "If your email is in our database, you will receive a reset link.",
        },
        200,
        request,
      );
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await setUserResetToken(db, user.id, token, expiresAt);

    const frontendUrl =
      process.env.FRONTEND_URL ??
      process.env.FRONTEND_ORIGIN ??
      "https://amankayare.com";
    const resetLink = `${frontendUrl.replace(/\/+$/, "")}/reset-password/${token}`;

    const subject = "Reset Your Password - DEV47";
    const body = `
    <h1>Password Reset Request</h1>
    <p>We received a request to reset your password for your DEV47 account.</p>
    <p>Click the link below to set a new password. This link will expire in 1 hour.</p>
    <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p>If you did not request this, please ignore this email.</p>
    `;

    const success = await sendEmail({
      to: user.email,
      subject,
      body,
      isHtml: true,
    });

    if (success) {
      return jsonResponse(
        { message: "Reset link sent successfully" },
        200,
        request,
      );
    }

    return jsonResponse(
      { error: "Failed to send reset email. Please try again later." },
      500,
      request,
    );
  } catch (error) {
    console.error("Forgot password failed:", error);
    return jsonResponse(
      { error: "Failed to send reset email. Please try again later." },
      500,
      request,
    );
  }
}
