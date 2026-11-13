import { generatePasswordHash } from "@/lib/auth/password";
import {
  clearUserResetTokenAndUpdatePassword,
  findUserByResetToken,
} from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const data = await parseJsonBody<{
      token?: string;
      new_password?: string;
    }>(request);

    const token = data?.token?.trim();
    const newPassword = data?.new_password;

    if (!token || !newPassword) {
      return jsonResponse(
        { error: "Token and new password are required" },
        400,
        request,
      );
    }

    const db = await getDatabaseProvider();
    const user = await findUserByResetToken(db, token);

    if (!user) {
      return jsonResponse(
        { error: "Invalid or expired reset token" },
        400,
        request,
      );
    }

    const expiresAt = user.reset_password_expires
      ? new Date(user.reset_password_expires).getTime()
      : 0;

    if (expiresAt < Date.now()) {
      return jsonResponse(
        { error: "Invalid or expired reset token" },
        400,
        request,
      );
    }

    const passwordHash = generatePasswordHash(newPassword);
    await clearUserResetTokenAndUpdatePassword(db, user.id, passwordHash);

    return jsonResponse(
      { message: "Password has been reset successfully" },
      200,
      request,
    );
  } catch (error) {
    console.error("Reset password failed:", error);
    return jsonResponse({ error: "Failed to reset password" }, 500, request);
  }
}
