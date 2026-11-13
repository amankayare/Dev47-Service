import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: "No file provided" }, 400, request);
  }

  const file = formData.get("file");
  if (!file || typeof file === "string") {
    return jsonResponse({ error: "No file provided" }, 400, request);
  }

  try {
    const upstreamFormData = new FormData();
    upstreamFormData.append("file", file as Blob, (file as File).name);

    const upstreamRes = await fetch(`${polyglotUrl}/api/v1/assets/stage`, {
      method: "POST",
      headers: {
        "x-api-key": polyglotApiKey,
      },
      body: upstreamFormData,
    });

    const data = (await upstreamRes.json()) as {
      success?: boolean;
      data?: {
        stageId?: string;
        previewUrl?: string;
      };
    };

    if (data.success && data.data && data.data.stageId) {
      data.data.previewUrl = `/api/polyglot/stage/${data.data.stageId}/preview`;
    }

    return jsonResponse(data, upstreamRes.status, request);
  } catch (error) {
    return jsonResponse(
      { error: `Staging failed: ${String(error)}` },
      500,
      request,
    );
  }
}
