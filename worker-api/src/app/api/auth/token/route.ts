import { createJwtToken } from "@/lib/auth/jwt";
import { checkPasswordHash } from "@/lib/auth/password";
import { findUserByUsername } from "@/lib/auth/user-repository";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Basic ")) {
    return jsonResponse(
      { error: "Missing or invalid Basic Auth credentials" },
      401,
      request,
    );
  }

  const base64Credentials = authHeader.slice("Basic ".length).trim();
  let decoded: string;
  try {
    decoded = Buffer.from(base64Credentials, "base64").toString("utf-8");
  } catch {
    return jsonResponse(
      { error: "Missing or invalid Basic Auth credentials" },
      401,
      request,
    );
  }

  const colonIndex = decoded.indexOf(":");
  if (colonIndex === -1) {
    return jsonResponse(
      { error: "Missing or invalid Basic Auth credentials" },
      401,
      request,
    );
  }

  const username = decoded.slice(0, colonIndex);
  const password = decoded.slice(colonIndex + 1);

  if (!username || !password) {
    return jsonResponse(
      { error: "Missing or invalid Basic Auth credentials" },
      401,
      request,
    );
  }

  try {
    const db = await getDatabaseProvider();
    const user = await findUserByUsername(db, username);

    if (user && checkPasswordHash(user.password_hash, password)) {
      const token = createJwtToken(user.username, user.id, Boolean(user.is_admin));
      return jsonResponse({ access_token: token }, 200, request);
    }

    return jsonResponse({ error: "Invalid credentials" }, 401, request);
  } catch (error) {
    console.error("Token issuance failed:", error);
    return jsonResponse({ error: "Invalid credentials" }, 401, request);
  }
}
