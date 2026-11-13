import { generatePasswordHash } from "@/lib/auth/password";
import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  formatUserDto,
} from "@/lib/auth/user-repository";
import { validateRegistration } from "@/lib/auth/validation";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  try {
    const body = await parseJsonBody(request);
    const validation = validateRegistration(body);

    if (!validation.valid || !validation.data) {
      return jsonResponse(
        { error: "Validation error", details: validation.errors },
        400,
        request,
      );
    }

    const { username, email, password } = validation.data;
    const db = await getDatabaseProvider();

    if (await findUserByUsername(db, username)) {
      return jsonResponse({ error: "Username already exists" }, 400, request);
    }

    if (await findUserByEmail(db, email)) {
      return jsonResponse({ error: "Email already exists" }, 400, request);
    }

    const passwordHash = generatePasswordHash(password);
    const user = await createUser(db, {
      username,
      email,
      passwordHash,
      isAdmin: false,
    });

    return jsonResponse(
      {
        message: "User registered successfully",
        user: formatUserDto(user),
      },
      201,
      request,
    );
  } catch (error) {
    console.error("User registration failed:", error);
    return jsonResponse({ error: "Registration failed" }, 500, request);
  }
}
