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

  const about = rows[0];
  if (!about || !about.resume_url) {
    return jsonResponse(
      { error: "No resume URL configured. Please upload a resume through the admin panel." },
      404,
      request,
    );
  }

  const resumeUrl = about.resume_url.trim();
  if (resumeUrl.startsWith("/static/uploads/")) {
    const filename = resumeUrl.split("/").pop();
    if (!filename) {
      return jsonResponse({ error: "Invalid resume file URL." }, 404, request);
    }

    const storage = await getStorageProvider();
    const file = await storage.get(filename);
    if (!file) {
      return jsonResponse(
        { error: `Resume file not found at ${resumeUrl}. Please re-upload through the admin panel.` },
        404,
        request,
      );
    }

    return new Response(file.data as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Aman_Kayare_Resume.pdf"',
      },
    });
  }

  return Response.redirect(resumeUrl, 302);
}
