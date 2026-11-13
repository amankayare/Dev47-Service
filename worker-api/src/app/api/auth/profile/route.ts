import { authenticateRequest } from "@/lib/auth/jwt";
import {
  findUserByEmail,
  findUserById,
  findUserByUsername,
  formatUserDto,
  updateUserProfile,
} from "@/lib/auth/user-repository";
import { validateProfileUpdate } from "@/lib/auth/validation";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  if (auth.user.user_id === null || auth.user.user_id === undefined) {
    return jsonResponse({ error: "User not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const user = await findUserById(db, auth.user.user_id);
    if (!user) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    return jsonResponse(formatUserDto(user), 200, request);
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return jsonResponse({ error: "Failed to fetch profile" }, 500, request);
  }
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
    const body = await parseJsonBody(request);
    const validation = validateProfileUpdate(body);

    if (!validation.valid || !validation.data) {
      return jsonResponse(
        { error: "Validation failed", details: validation.errors },
        400,
        request,
      );
    }

    const { username, email } = validation.data;
    const db = await getDatabaseProvider();
    const user = await findUserById(db, auth.user.user_id);
    if (!user) {
      return jsonResponse({ error: "User not found" }, 404, request);
    }

    if (username !== user.username) {
      const existing = await findUserByUsername(db, username);
      if (existing) {
        return jsonResponse({ error: "Username already exists" }, 409, request);
      }
    }

    if (email !== user.email) {
      const existing = await findUserByEmail(db, email);
      if (existing) {
        return jsonResponse({ error: "Email already exists" }, 409, request);
      }
    }

    const updated = await updateUserProfile(db, user.id, username, email);
    return jsonResponse(
      {
        message: "Profile updated successfully",
        user: formatUserDto(updated),
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Failed to update profile:", error);
    return jsonResponse({ error: "Failed to update profile" }, 500, request);
  }
}
