import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createProject,
  formatProjectDto,
  getVisibleProjects,
  normalizeDateInput,
  parseCategoriesInput,
  parseLinksInput,
} from "@/lib/projects/project-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await getDatabaseProvider();
    const projects = await getVisibleProjects(db);
    return jsonResponse(projects.map(formatProjectDto), 200, request);
  } catch (error) {
    console.error("Failed to fetch visible projects:", error);
    return jsonResponse([], 500, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};

    const title = typeof data.title === "string" ? data.title.trim() : "";
    const description =
      typeof data.description === "string" ? data.description.trim() : "";

    if (!title || !description) {
      return jsonResponse(
        { errors: "Title and description are required." },
        400,
        request,
      );
    }

    // Support both tech_stack and tech
    const rawTech = data.tech_stack ?? data.tech;
    const tech = Array.isArray(rawTech)
      ? rawTech.map(String).map((s) => s.trim()).filter(Boolean)
      : typeof rawTech === "string"
        ? rawTech.split(",").map((s) => s.trim()).filter(Boolean)
        : [];

    const links = parseLinksInput(data.links);
    const categories = parseCategoriesInput(data.categories);
    const gallery = Array.isArray(data.gallery)
      ? data.gallery.map(String).map((s) => s.trim()).filter(Boolean)
      : [];

    const db = await getDatabaseProvider();
    const created = await createProject(db, {
      title,
      description,
      tech,
      links,
      image: typeof data.image === "string" ? data.image.trim() : "",
      gallery,
      project_type:
        typeof data.project_type === "string" ? data.project_type.trim() : "",
      start_date: normalizeDateInput(data.start_date),
      end_date: normalizeDateInput(data.end_date),
      role: typeof data.role === "string" ? data.role.trim() : "",
      team_size:
        data.team_size !== null && data.team_size !== undefined && data.team_size !== ""
          ? Number(data.team_size)
          : null,
      categories,
      is_visible: data.is_visible !== false,
      is_featured: Boolean(data.is_featured),
      order:
        data.order !== null && data.order !== undefined && data.order !== ""
          ? Number(data.order)
          : 0,
    });

    return jsonResponse(formatProjectDto(created), 201, request);
  } catch (error) {
    console.error("Create project failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}
