import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createCertification,
  formatCertificationDto,
  getAllCertifications,
} from "@/lib/certifications/certification-repository";
import {
  normalizeDateInput,
  parseCategoriesInput,
} from "@/lib/projects/project-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await getDatabaseProvider();
    const certs = await getAllCertifications(db);
    return jsonResponse(certs.map(formatCertificationDto), 200, request);
  } catch (error) {
    console.error("Failed to fetch certifications:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};

    const name = typeof data.name === "string" ? data.name.trim() : "";
    const issuer = typeof data.issuer === "string" ? data.issuer.trim() : "";

    if (!name || !issuer) {
      return jsonResponse(
        { errors: "Name and issuer are required." },
        400,
        request,
      );
    }

    const skills = parseCategoriesInput(data.skills);

    const db = await getDatabaseProvider();
    const created = await createCertification(db, {
      name,
      issuer,
      date: typeof data.date === "string" ? data.date.trim() : "",
      credential_url:
        typeof data.credential_url === "string"
          ? data.credential_url.trim()
          : "",
      description:
        typeof data.description === "string" ? data.description.trim() : "",
      skills,
      certificate_id:
        typeof data.certificate_id === "string"
          ? data.certificate_id.trim()
          : "",
      expiration_date: normalizeDateInput(data.expiration_date),
      is_visible: data.is_visible !== false,
    });

    return jsonResponse(formatCertificationDto(created), 201, request);
  } catch (error) {
    console.error("Create certification failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}
