import crypto from "node:crypto";
import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
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

  const blob = file as File;
  if (!blob.name) {
    return jsonResponse({ error: "No file selected" }, 400, request);
  }

  if (blob.size > MAX_FILE_SIZE) {
    return jsonResponse(
      { error: "File too large. Maximum size is 10MB" },
      413,
      request,
    );
  }

  const ext = blob.name.split(".").pop()?.toLowerCase();
  if (ext !== "pdf") {
    return jsonResponse(
      { error: "Invalid file type. Only PDF files are allowed" },
      400,
      request,
    );
  }

  if (blob.type && blob.type !== "application/pdf") {
    return jsonResponse({ error: "File must be a PDF" }, 400, request);
  }

  const uniqueId = crypto.randomUUID().replace(/-/g, "");
  const secureName = `resume_${uniqueId}.pdf`;

  const arrayBuffer = await blob.arrayBuffer();
  const storage = await getStorageProvider();
  await storage.put(secureName, new Uint8Array(arrayBuffer), "application/pdf");

  return jsonResponse(
    {
      url: `/static/uploads/${secureName}`,
      filename: secureName,
      message: "Resume uploaded successfully",
    },
    200,
    request,
  );
}
