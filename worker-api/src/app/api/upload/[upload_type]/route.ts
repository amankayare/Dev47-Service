import crypto from "node:crypto";
import { authenticateRequest } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import { getStorageProvider } from "@/lib/storage";

export const dynamic = "force-dynamic";

const VALID_TYPES = ["profile", "cover", "project", "certificate", "resume"] as const;
type UploadType = (typeof VALID_TYPES)[number];

const ALLOWED_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp"]);
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface RouteContext {
  params: Promise<{ upload_type: string }>;
}

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { upload_type: rawType } = await context.params;
  const uploadType = rawType.toLowerCase();

  if (!VALID_TYPES.includes(uploadType as UploadType)) {
    return jsonResponse(
      { error: `Invalid upload type. Must be one of: ${VALID_TYPES.join(", ")}` },
      400,
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

  const blob = file as File;
  if (!blob.name) {
    return jsonResponse({ error: "No file selected" }, 400, request);
  }

  if (blob.size > MAX_FILE_SIZE) {
    return jsonResponse(
      { error: "File too large. Maximum size is 5MB" },
      413,
      request,
    );
  }

  const ext = blob.name.split(".").pop()?.toLowerCase() ?? "";

  if (uploadType === "resume") {
    if (ext !== "pdf") {
      return jsonResponse(
        { error: "Invalid file type. Resume must be PDF" },
        400,
        request,
      );
    }
    if (blob.type && blob.type !== "application/pdf") {
      return jsonResponse({ error: "File must be a PDF" }, 400, request);
    }
  } else {
    if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      return jsonResponse(
        { error: "Invalid file type. Allowed types: PNG, JPG, JPEG, GIF, WEBP" },
        400,
        request,
      );
    }
    if (blob.type && !blob.type.startsWith("image/")) {
      return jsonResponse({ error: "File must be an image" }, 400, request);
    }
  }

  const uniqueId = crypto.randomUUID().replace(/-/g, "");
  const secureName = `${uploadType}_${uniqueId}.${ext}`;

  const arrayBuffer = await blob.arrayBuffer();
  const storage = await getStorageProvider();
  await storage.put(
    secureName,
    new Uint8Array(arrayBuffer),
    blob.type || (uploadType === "resume" ? "application/pdf" : `image/${ext}`),
  );

  const capitalizedType = uploadType.charAt(0).toUpperCase() + uploadType.slice(1);
  return jsonResponse(
    {
      url: `/static/uploads/${secureName}`,
      filename: secureName,
      message: `${capitalizedType} ${uploadType === "resume" ? "file" : "image"} uploaded successfully`,
    },
    200,
    request,
  );
}
