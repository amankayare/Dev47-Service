import { createJwtToken } from "@/lib/auth/jwt";
import { checkPasswordHash } from "@/lib/auth/password";
import {
  findUserByUsernameOrEmail,
  formatUserDto,
  updateUserLastLogin,
} from "@/lib/auth/user-repository";
import { validateLogin } from "@/lib/auth/validation";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    const validation = validateLogin(body);

    if (!validation.valid || !validation.data) {
      return jsonResponse(
        { error: "Validation error", details: validation.errors },
        400,
        request,
      );
    }

    const { username, password } = validation.data;
    const db = await getDatabaseProvider();
    const user = await findUserByUsernameOrEmail(db, username);

    if (user && checkPasswordHash(user.password_hash, password)) {
      await updateUserLastLogin(db, user.id);
      const token = createJwtToken(user.username, user.id, Boolean(user.is_admin));

      // Update in-memory user record's last_login for serialization
      const userWithUpdatedLogin = {
        ...user,
        last_login: new Date().toISOString(),
      };

      return jsonResponse(
        {
          access_token: token,
          user: formatUserDto(userWithUpdatedLogin),
          message: "Login successful",
        },
        200,
        request,
      );
    }

    return jsonResponse({ error: "Invalid credentials" }, 401, request);
  } catch (error) {
    console.error("Login failed:", error);
    return jsonResponse({ error: "Login failed" }, 500, request);
  }
}
