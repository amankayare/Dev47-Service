import { authenticateRequest } from "@/lib/auth/jwt";
import { checkPasswordHash, generatePasswordHash } from "@/lib/auth/password";
import {
  findUserById,
  updateUserPassword,
} from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function PUT(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  try {
    const data = await parseJsonBody<{
      currentPassword?: string;
      newPassword?: string;
    }>(request);

    if (!data || typeof data !== "object") {
      return jsonResponse({ error: "Request body required" }, 400, request);
    }

    const currentPassword = data.currentPassword;
    const newPassword = data.newPassword;

    if (!currentPassword || !newPassword) {
      return jsonResponse(
        { error: "Both currentPassword and newPassword are required" },
        400,
        request,
      );
    }

    if (newPassword.length < 8) {
      return jsonResponse(
        { error: "New password must be at least 8 characters long" },
        400,
        request,
      );
    }

    const db = await getDatabaseProvider();
    const user = await findUserById(db, auth.user.user_id);
    if (!user) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    if (!checkPasswordHash(user.password_hash, currentPassword)) {
      return jsonResponse(
        { error: "Current password is incorrect" },
        401,
        request,
      );
    }

    if (checkPasswordHash(user.password_hash, newPassword)) {
      return jsonResponse(
        { error: "New password must be different from current password" },
        400,
        request,
      );
    }

    const newPasswordHash = generatePasswordHash(newPassword);
    await updateUserPassword(db, user.id, newPasswordHash);

    return jsonResponse(
      { message: "Password changed successfully" },
      200,
      request,
    );
  } catch (error) {
    console.error("Change password failed:", error);
    return jsonResponse({ error: "Failed to change password" }, 500, request);
  }
}
