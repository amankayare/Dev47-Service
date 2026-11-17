import crypto from "node:crypto";
import { jsonResponse } from "@/lib/http";

export interface JwtPayload {
  sub: string;
  user_id: number | null;
  is_admin: boolean;
  exp: number;
}

export interface JwtError {
  error: "token_expired" | "invalid_token" | "no_token" | "invalid_request";
  message: string;
}

export function isJwtError(result: JwtPayload | JwtError): result is JwtError {
  return "error" in result;
}

export function getJwtSecret(): string {
  try {
    const cloudflareEnv = (globalThis as any)[Symbol.for("__cloudflare-context__")]?.env;
    if (cloudflareEnv?.JWT_SECRET && typeof cloudflareEnv.JWT_SECRET === "string") {
      const secret = cloudflareEnv.JWT_SECRET.trim();
      if (secret) return secret;
    }
  } catch {
    // ignore
  }
  return (process.env.JWT_SECRET ?? "changeme").trim() || "changeme";
}

export function getJwtExpMinutes(): number {
  try {
    const cloudflareEnv = (globalThis as any)[Symbol.for("__cloudflare-context__")]?.env;
    if (cloudflareEnv?.JWT_EXP_MINUTES) {
      const parsed = parseInt(String(cloudflareEnv.JWT_EXP_MINUTES), 10);
      if (!Number.isNaN(parsed) && parsed > 0) return parsed;
    }
  } catch {
    // ignore
  }
  const parsed = parseInt(process.env.JWT_EXP_MINUTES ?? "1440", 10);
  return Number.isNaN(parsed) || parsed <= 0 ? 1440 : parsed;
}

function base64UrlEncode(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf-8") : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function base64UrlDecode(input: string): Buffer {
  let base64 = input.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }
  return Buffer.from(base64, "base64");
}

/**
 * Creates an HS256 JWT token compatible with PyJWT.
 */
export function createJwtToken(
  identity: string,
  userId: number | null = null,
  isAdmin = false,
  secretOverride?: string,
): string {
  const secret = secretOverride ?? getJwtSecret();
  const expMinutes = getJwtExpMinutes();
  const exp = Math.floor(Date.now() / 1000) + expMinutes * 60;

  const header = {
    alg: "HS256",
    typ: "JWT",
  };

  const payload: JwtPayload = {
    sub: identity,
    user_id: userId,
    is_admin: Boolean(isAdmin),
    exp,
  };

  const headerEncoded = base64UrlEncode(JSON.stringify(header));
  const payloadEncoded = base64UrlEncode(JSON.stringify(payload));
  const signingInput = `${headerEncoded}.${payloadEncoded}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signingInput)
    .digest();
  const signatureEncoded = base64UrlEncode(signature);

  return `${signingInput}.${signatureEncoded}`;
}

/**
 * Decodes and verifies an HS256 JWT token.
 * Returns payload or exact Flask-compatible error objects:
 * - { error: 'token_expired', message: 'Token has expired' }
 * - { error: 'invalid_token', message: 'Invalid token' }
 */
export function decodeJwtToken(
  token: string,
  secretOverride?: string,
): JwtPayload | JwtError {
  if (!token || typeof token !== "string") {
    return { error: "invalid_token", message: "Invalid token" };
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { error: "invalid_token", message: "Invalid token" };
  }

  const [headerEncoded, payloadEncoded, signatureEncoded] = parts;

  try {
    const headerJson = base64UrlDecode(headerEncoded).toString("utf-8");
    const header = JSON.parse(headerJson) as { alg?: string; typ?: string };
    if (header.alg !== "HS256") {
      return { error: "invalid_token", message: "Invalid token" };
    }

    const secret = secretOverride ?? getJwtSecret();
    const signingInput = `${headerEncoded}.${payloadEncoded}`;
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(signingInput)
      .digest();
    const actualSignature = base64UrlDecode(signatureEncoded);

    if (
      expectedSignature.length !== actualSignature.length ||
      !crypto.timingSafeEqual(expectedSignature, actualSignature)
    ) {
      return { error: "invalid_token", message: "Invalid token" };
    }

    const payloadJson = base64UrlDecode(payloadEncoded).toString("utf-8");
    const payload = JSON.parse(payloadJson) as JwtPayload;

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp === "number" && payload.exp < now) {
      return { error: "token_expired", message: "Token has expired" };
    }

    return payload;
  } catch {
    return { error: "invalid_token", message: "Invalid token" };
  }
}

/**
 * Extracts a token from an Authorization header.
 * Supports both "Bearer <token>" and raw "<token>", matching legacy Flask behavior.
 */
export function extractTokenFromHeader(
  authHeader: string | null | undefined,
): string | null {
  if (!authHeader) {
    return null;
  }
  const trimmed = authHeader.trim();
  if (trimmed.startsWith("Bearer ")) {
    return trimmed.slice("Bearer ".length).trim();
  }
  return trimmed;
}

export type AuthResult =
  | { authenticated: true; user: JwtPayload }
  | { authenticated: false; response: Response };

/**
 * Authenticates an incoming HTTP request using Bearer JWT.
 * Preserves Flask status codes and error payloads.
 */
export function authenticateRequest(
  request: Request,
  secretOverride?: string,
): AuthResult {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) {
    return {
      authenticated: false,
      response: jsonResponse(
        { error: "no_token", message: "Authorization token required" },
        401,
        request,
      ),
    };
  }

  const token = extractTokenFromHeader(authHeader);
  if (!token) {
    return {
      authenticated: false,
      response: jsonResponse(
        { error: "invalid_request", message: "Invalid authentication request" },
        401,
        request,
      ),
    };
  }

  const decoded = decodeJwtToken(token, secretOverride);
  if (isJwtError(decoded)) {
    return {
      authenticated: false,
      response: jsonResponse(decoded, 401, request),
    };
  }

  return { authenticated: true, user: decoded };
}

/**
 * Enforces admin authorization from JWT claims.
 * Preserves Flask error response:
 * 403 { error: 'admin_required', message: 'Admin privileges required' }
 */
export function requireAdmin(
  request: Request,
  secretOverride?: string,
): AuthResult {
  const auth = authenticateRequest(request, secretOverride);
  if (!auth.authenticated) {
    return auth;
  }

  if (!auth.user.is_admin) {
    return {
      authenticated: false,
      response: jsonResponse(
        { error: "admin_required", message: "Admin privileges required" },
        403,
        request,
      ),
    };
  }

  return auth;
}
