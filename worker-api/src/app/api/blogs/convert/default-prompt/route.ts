import { requireAdmin } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/integrations/gemini-service";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  return jsonResponse(
    { prompt: DEFAULT_SYSTEM_PROMPT },
    200,
    request,
  );
}
