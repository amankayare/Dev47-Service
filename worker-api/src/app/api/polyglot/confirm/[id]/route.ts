import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
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

  let provider = "github";
  try {
    const body = (await request.json()) as { provider?: string };
    if (body.provider) {
      provider = body.provider;
    }
  } catch {
    // Body is optional
  }

  try {
    const upstreamRes = await fetch(
      `${polyglotUrl}/api/v1/assets/stage/${stageId}/confirm`,
      {
        method: "POST",
        headers: {
          "x-api-key": polyglotApiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ provider }),
      },
    );

    const data = await upstreamRes.json();
    return jsonResponse(data, upstreamRes.status, request);
  } catch (error) {
    return jsonResponse(
      { error: `Confirmation failed: ${String(error)}` },
      500,
      request,
    );
  }
}
