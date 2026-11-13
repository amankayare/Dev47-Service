import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  deleteTechnicalSkill,
  formatTechnicalSkillDto,
  getTechnicalSkillById,
  type TechnicalSkillInputParams,
  updateTechnicalSkill,
} from "@/lib/technical-skills/technical-skill-repository";
import { parseCategoriesInput } from "@/lib/projects/project-repository";

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
  const skillId = parseInt(id, 10);
  if (Number.isNaN(skillId)) {
    return jsonResponse({ error: "Technical skill not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const skill = await getTechnicalSkillById(db, skillId);
    if (!skill) {
      return jsonResponse({ error: "Technical skill not found" }, 404, request);
    }

    return jsonResponse(formatTechnicalSkillDto(skill), 200, request);
  } catch (error) {
    console.error("Failed to fetch technical skill:", error);
    return jsonResponse({ error: "Failed to fetch technical skill" }, 500, request);
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
  const skillId = parseInt(id, 10);
  if (Number.isNaN(skillId)) {
    return jsonResponse({ error: "Technical skill not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getTechnicalSkillById(db, skillId);
    if (!existing) {
      return jsonResponse({ error: "Technical skill not found" }, 404, request);
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const updateParams: Partial<TechnicalSkillInputParams> = {};

    if (data.title !== undefined) {
      updateParams.title =
        typeof data.title === "string" ? data.title.trim() : "";
    }
    if (data.skills !== undefined) {
      updateParams.skills = parseCategoriesInput(data.skills);
    }
    if (data.color !== undefined) {
      updateParams.color =
        typeof data.color === "string" ? data.color.trim() : "";
    }
    if (data.icon !== undefined) {
      updateParams.icon =
        typeof data.icon === "string" ? data.icon.trim() : "";
    }
    if (data.order !== undefined) {
      updateParams.order =
        data.order !== null && data.order !== "" ? Number(data.order) : 0;
    }
    if (data.is_visible !== undefined) {
      updateParams.is_visible = Boolean(data.is_visible);
    }

    const updated = await updateTechnicalSkill(db, skillId, updateParams);
    if (!updated) {
      return jsonResponse({ error: "Technical skill not found" }, 404, request);
    }

    return jsonResponse(formatTechnicalSkillDto(updated), 200, request);
  } catch (error) {
    console.error("Update technical skill failed:", error);
    return jsonResponse({ error: "Failed to update technical skill" }, 500, request);
  }
}

export async function DELETE(
  request: Request,
  context: RouteContext,
): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  const { id } = await context.params;
  const skillId = parseInt(id, 10);
  if (Number.isNaN(skillId)) {
    return jsonResponse({ error: "Technical skill not found" }, 404, request);
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getTechnicalSkillById(db, skillId);
    if (!existing) {
      return jsonResponse({ error: "Technical skill not found" }, 404, request);
    }

    await deleteTechnicalSkill(db, skillId);
    return jsonResponse(
      { message: "Technical skill deleted successfully" },
      200,
      request,
    );
  } catch (error) {
    console.error("Delete technical skill failed:", error);
    return jsonResponse({ error: "Failed to delete technical skill" }, 500, request);
  }
}
