import { authenticateRequest, requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  deleteProject,
  formatProjectDto,
  getProjectById,
  normalizeDateInput,
  parseCategoriesInput,
  parseLinksInput,
  type ProjectInputParams,
  updateProject,
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
  const projectId = parseInt(id, 10);
  if (Number.isNaN(projectId)) {
    return jsonResponse({ error: "Project not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const project = await getProjectById(db, projectId);
    if (!project) {
      return jsonResponse({ error: "Project not found" }, 404, request);
    }

    return jsonResponse(formatProjectDto(project), 200, request);
  } catch (error) {
    console.error("Failed to fetch project:", error);
    return jsonResponse({ error: "Failed to fetch project" }, 500, request);
  }
}

export async function PUT(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const projectId = parseInt(id, 10);
  if (Number.isNaN(projectId)) {
    return jsonResponse({ error: "Project not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getProjectById(db, projectId);
    if (!existing) {
      return jsonResponse({ error: "Project not found" }, 404, request);
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const updateParams: Partial<ProjectInputParams> = {};

    if (data.title !== undefined) {
      updateParams.title =
        typeof data.title === "string" ? data.title.trim() : "";
    }
    if (data.description !== undefined) {
      updateParams.description =
        typeof data.description === "string" ? data.description.trim() : "";
    }

    const rawTech = data.tech_stack ?? data.tech;
    if (rawTech !== undefined) {
      updateParams.tech = Array.isArray(rawTech)
        ? rawTech.map(String).map((s) => s.trim()).filter(Boolean)
        : typeof rawTech === "string"
          ? rawTech.split(",").map((s) => s.trim()).filter(Boolean)
          : [];
    }

    if (data.links !== undefined) {
      updateParams.links = parseLinksInput(data.links);
    }
    if (data.categories !== undefined) {
      updateParams.categories = parseCategoriesInput(data.categories);
    }
    if (data.gallery !== undefined) {
      updateParams.gallery = Array.isArray(data.gallery)
        ? data.gallery.map(String).map((s) => s.trim()).filter(Boolean)
        : [];
    }
    if (data.image !== undefined) {
      updateParams.image =
        typeof data.image === "string" ? data.image.trim() : "";
    }
    if (data.project_type !== undefined) {
      updateParams.project_type =
        typeof data.project_type === "string" ? data.project_type.trim() : "";
    }
    if (data.role !== undefined) {
      updateParams.role =
        typeof data.role === "string" ? data.role.trim() : "";
    }
    if (data.team_size !== undefined) {
      updateParams.team_size =
        data.team_size !== null && data.team_size !== ""
          ? Number(data.team_size)
          : null;
    }
    if (data.is_visible !== undefined) {
      updateParams.is_visible = Boolean(data.is_visible);
    }
    if (data.is_featured !== undefined) {
      updateParams.is_featured = Boolean(data.is_featured);
    }
    if (data.order !== undefined) {
      updateParams.order =
        data.order !== null && data.order !== "" ? Number(data.order) : 0;
    }
    if (data.start_date !== undefined) {
      updateParams.start_date = normalizeDateInput(data.start_date);
    }
    if (data.end_date !== undefined) {
      updateParams.end_date = normalizeDateInput(data.end_date);
    }

    const updated = await updateProject(db, projectId, updateParams);
    if (!updated) {
      return jsonResponse({ error: "Project not found" }, 404, request);
    }

    return jsonResponse(formatProjectDto(updated), 200, request);
  } catch (error) {
    console.error("Update project failed:", error);
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
  const projectId = parseInt(id, 10);
  if (Number.isNaN(projectId)) {
    return jsonResponse({ error: "Project not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getProjectById(db, projectId);
    if (!existing) {
      return jsonResponse({ error: "Project not found" }, 404, request);
    }

    await deleteProject(db, projectId);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (error) {
    console.error("Delete project failed:", error);
    return jsonResponse({ error: "Failed to delete project" }, 500, request);
  }
}
