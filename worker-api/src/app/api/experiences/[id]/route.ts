import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  deleteExperience,
  type ExperienceInputParams,
  formatExperienceDto,
  getExperienceById,
  updateExperience,
} from "@/lib/experiences/experience-repository";
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
  const expId = parseInt(id, 10);
  if (Number.isNaN(expId)) {
    return jsonResponse({ error: "Experience not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const exp = await getExperienceById(db, expId);
    if (!exp) {
      return jsonResponse({ error: "Experience not found" }, 404, request);
    }

    return jsonResponse(formatExperienceDto(exp), 200, request);
  } catch (error) {
    console.error("Failed to fetch experience:", error);
    return jsonResponse({ error: String(error) }, 500, request);
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
  const expId = parseInt(id, 10);
  if (Number.isNaN(expId)) {
    return jsonResponse({ error: "Experience not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getExperienceById(db, expId);
    if (!existing) {
      return jsonResponse({ error: "Experience not found" }, 404, request);
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const updateParams: Partial<ExperienceInputParams> = {};

    for (const field of ["title", "company", "location", "duration", "color"]) {
      if (data[field] !== undefined) {
        (updateParams as Record<string, unknown>)[field] =
          typeof data[field] === "string" ? (data[field] as string).trim() : "";
      }
    }

    if (data.start_date !== undefined) {
      updateParams.start_date = normalizeDateInput(data.start_date);
    }
    if (data.end_date !== undefined) {
      updateParams.end_date = normalizeDateInput(data.end_date);
    }
    if (data.is_current !== undefined) {
      updateParams.is_current = Boolean(data.is_current);
    }
    if (data.responsibilities !== undefined) {
      updateParams.responsibilities = parseCategoriesInput(data.responsibilities);
    }
    if (data.achievements !== undefined) {
      updateParams.achievements = parseCategoriesInput(data.achievements);
    }
    if (data.technologies !== undefined) {
      updateParams.technologies = parseCategoriesInput(data.technologies);
    }
    if (data.order !== undefined) {
      updateParams.order =
        data.order !== null && data.order !== "" ? Number(data.order) : 0;
    }
    if (data.is_visible !== undefined) {
      updateParams.is_visible = Boolean(data.is_visible);
    }

    const updated = await updateExperience(db, expId, updateParams);
    if (!updated) {
      return jsonResponse({ error: "Experience not found" }, 404, request);
    }

    return jsonResponse(
      {
        message: "Experience updated successfully",
        experience: formatExperienceDto(updated),
      },
      200,
      request,
    );
  } catch (error) {
    console.error("Update experience failed:", error);
    return jsonResponse({ error: String(error) }, 400, request);
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
  const expId = parseInt(id, 10);
  if (Number.isNaN(expId)) {
    return jsonResponse({ error: "Experience not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getExperienceById(db, expId);
    if (!existing) {
      return jsonResponse({ error: "Experience not found" }, 404, request);
    }

    await deleteExperience(db, expId);
    return jsonResponse(
      { message: "Experience deleted successfully" },
      200,
      request,
    );
  } catch (error) {
    console.error("Delete experience failed:", error);
    return jsonResponse({ error: String(error) }, 500, request);
  }
}
