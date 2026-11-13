import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const ALLOWED_PREFIXES = [
  "profile_",
  "cover_",
  "project_",
  "certificate_",
  "resume_",
];

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
  if (!filename || !ALLOWED_PREFIXES.some((prefix) => filename.startsWith(prefix))) {
    return jsonResponse({ error: "Invalid filename" }, 400, request);
  }

  const storage = await getStorageProvider();
  const exists = await storage.has(filename);
  if (!exists) {
    return jsonResponse({ error: "File not found" }, 404, request);
  }

  await storage.delete(filename);
  return jsonResponse(
    { message: "File deleted successfully" },
    200,
    request,
  );
}
