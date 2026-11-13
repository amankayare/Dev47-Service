import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ filename: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function DELETE(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { filename } = await context.params;
  if (!filename || !filename.startsWith("resume_")) {
    return jsonResponse({ error: "Invalid filename" }, 400, request);
  }

  const storage = await getStorageProvider();
  const exists = await storage.has(filename);
  if (!exists) {
    return jsonResponse({ error: "Resume file not found" }, 404, request);
  }

  await storage.delete(filename);
  return jsonResponse(
    { message: "Resume deleted successfully" },
    200,
    request,
  );
}
