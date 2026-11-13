import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function GET(request: Request) {
  const db = await getDatabaseProvider();
  const rows = await db.query<{ resume_url: string | null }>(
    "SELECT resume_url FROM about LIMIT 1",
  );

  const resumeUrl = rows[0]?.resume_url ?? null;
  let fileExists = false;

  if (resumeUrl?.startsWith("/static/uploads/")) {
    const filename = resumeUrl.split("/").pop();
    if (filename) {
      const storage = await getStorageProvider();
      fileExists = await storage.has(filename);
    }
  }

  return jsonResponse(
    {
      resume_url: resumeUrl,
      configured: Boolean(resumeUrl),
      file_exists: fileExists,
    },
    200,
    request,
  );
}
