import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  deleteCertification,
  formatCertificationDto,
  getCertificationById,
  type CertificationInputParams,
  updateCertification,
} from "@/lib/certifications/certification-repository";
import {
  normalizeDateInput,
  parseCategoriesInput,
} from "@/lib/projects/project-repository";

export const dynamic = "force-dynamic";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const { id } = await context.params;
  const certId = parseInt(id, 10);
  if (Number.isNaN(certId)) {
    return jsonResponse({ error: "Certification not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const cert = await getCertificationById(db, certId);
    if (!cert) {
      return jsonResponse({ error: "Certification not found" }, 404, request);
    }

    return jsonResponse(formatCertificationDto(cert), 200, request);
  } catch (error) {
    console.error("Failed to fetch certification:", error);
    return jsonResponse({ error: "Failed to fetch certification" }, 500, request);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const certId = parseInt(id, 10);
  if (Number.isNaN(certId)) {
    return jsonResponse({ error: "Certification not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getCertificationById(db, certId);
    if (!existing) {
      return jsonResponse({ error: "Certification not found" }, 404, request);
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const updateParams: Partial<CertificationInputParams> = {};

    for (const field of [
      "name",
      "issuer",
      "date",
      "credential_url",
      "description",
      "certificate_id",
    ]) {
      if (data[field] !== undefined) {
        (updateParams as Record<string, unknown>)[field] =
          typeof data[field] === "string" ? (data[field] as string).trim() : "";
      }
    }

    if (data.skills !== undefined) {
      updateParams.skills = parseCategoriesInput(data.skills);
    }
    if (data.expiration_date !== undefined) {
      updateParams.expiration_date = normalizeDateInput(data.expiration_date);
    }
    if (data.is_visible !== undefined) {
      updateParams.is_visible = Boolean(data.is_visible);
    }

    const updated = await updateCertification(db, certId, updateParams);
    if (!updated) {
      return jsonResponse({ error: "Certification not found" }, 404, request);
    }

    return jsonResponse(formatCertificationDto(updated), 200, request);
  } catch (error) {
    console.error("Update certification failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const certId = parseInt(id, 10);
  if (Number.isNaN(certId)) {
    return jsonResponse({ error: "Certification not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getCertificationById(db, certId);
    if (!existing) {
      return jsonResponse({ error: "Certification not found" }, 404, request);
    }

    await deleteCertification(db, certId);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (error) {
    console.error("Delete certification failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}
