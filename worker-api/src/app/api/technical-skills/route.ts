import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createTechnicalSkill,
  formatTechnicalSkillDto,
  getTechnicalSkills,
} from "@/lib/technical-skills/technical-skill-repository";
import { parseCategoriesInput } from "@/lib/projects/project-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const showAll = url.searchParams.get("admin")?.toLowerCase() === "true";

    const db = await getDatabaseProvider();
    const skills = await getTechnicalSkills(db, showAll);
    return jsonResponse(skills.map(formatTechnicalSkillDto), 200, request);
  } catch (error) {
    console.error("Failed to fetch technical skills:", error);
    return jsonResponse({ error: "Failed to fetch technical skills" }, 500, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};

    const title = typeof data.title === "string" ? data.title.trim() : "";
    if (!title) {
      return jsonResponse(
        { error: "Validation failed", details: { title: ["Missing data for required field."] } },
        400,
        request,
      );
    }

    const rawSkills = data.skills;
    const skills = parseCategoriesInput(rawSkills);

    const db = await getDatabaseProvider();
    const created = await createTechnicalSkill(db, {
      title,
      skills,
      color: typeof data.color === "string" ? data.color.trim() : "",
      icon: typeof data.icon === "string" ? data.icon.trim() : "",
      order:
        data.order !== null && data.order !== undefined && data.order !== ""
          ? Number(data.order)
          : 0,
      is_visible: data.is_visible !== false,
    });

    return jsonResponse(formatTechnicalSkillDto(created), 201, request);
  } catch (error) {
    console.error("Create technical skill failed:", error);
    return jsonResponse({ error: "Failed to create technical skill" }, 500, request);
  }
}
