import { decodeJwtToken, isJwtError } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request, context: RouteContext) {
  const url = new URL(request.url);
  let token = url.searchParams.get("jwt");

  if (!token) {
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice("Bearer ".length).trim();
    }
  }

  if (!token) {
    return jsonResponse(
      { error: "Authorization token required" },
      401,
      request,
    );
  }

  const payload = decodeJwtToken(token);
  if (isJwtError(payload)) {
    return jsonResponse(payload, 401, request);
  }

  const polyglotUrl = process.env.POLYGLOT_URL;
  const polyglotApiKey = process.env.POLYGLOT_API_KEY;

  if (!polyglotUrl || !polyglotApiKey) {
    return jsonResponse(
      { error: "Polyglot Storage is not configured" },
      500,
      request,
    );
  }

  const { id: stageId } = await context.params;

  try {
    const upstreamRes = await fetch(
      `${polyglotUrl}/api/v1/assets/stage/${stageId}/preview`,
      {
        method: "GET",
        headers: {
          "x-api-key": polyglotApiKey,
        },
      },
    );

    const arrayBuffer = await upstreamRes.arrayBuffer();
    const responseHeaders = new Headers();
    const contentType = upstreamRes.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);

    return new Response(arrayBuffer, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    return jsonResponse(
      { error: `Preview failed: ${String(error)}` },
      500,
      request,
    );
  }
}
