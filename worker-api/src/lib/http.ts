export function getAllowedOrigins(): string[] {
  const configured = process.env.CORS_ORIGINS ?? "";
  const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
  const frontendUrl = process.env.FRONTEND_URL ?? "";

  const origins = new Set<string>();
  origins.add("http://localhost:3000");
  origins.add("http://localhost:5000");
  origins.add("http://127.0.0.1:3000");
  origins.add("http://127.0.0.1:5000");
  origins.add("https://amankayare.com");
  origins.add("https://www.amankayare.com");
  origins.add("https://dev47-ui.pages.dev");

  if (frontendOrigin) origins.add(frontendOrigin.trim().replace(/\/+$/, ""));
  if (frontendUrl) origins.add(frontendUrl.trim().replace(/\/+$/, ""));

  for (const part of configured.split(",")) {
    const trimmed = part.trim().replace(/\/+$/, "");
    if (trimmed) {
      origins.add(trimmed);
    }
  }

  return Array.from(origins);
}

export function getCorsHeaders(request?: Request): Record<string, string> {
  const origin = request?.headers.get("origin")?.trim().replace(/\/+$/, "");
  const allowed = getAllowedOrigins();

  const matchedOrigin =
    origin && (allowed.includes(origin) || origin.startsWith("http://localhost:"))
      ? origin
      : allowed[0] ?? "*";

  return {
    "Access-Control-Allow-Origin": matchedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Expose-Headers": "Content-Type, Authorization",
  };
}

export function handleOptions(request: Request): Response {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request),
  });
}

export function jsonResponse(
  data: unknown,
  status = 200,
  request?: Request,
  additionalHeaders: Record<string, string> = {},
): Response {
  const cors = getCorsHeaders(request);
  return Response.json(data, {
    status,
    headers: {
      ...cors,
      ...additionalHeaders,
    },
  });
}

export async function parseJsonBody<T = Record<string, unknown>>(
  request: Request,
): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
