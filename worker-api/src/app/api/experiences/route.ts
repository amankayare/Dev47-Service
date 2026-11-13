import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createExperience,
  formatExperienceDto,
  getExperiences,
} from "@/lib/experiences/experience-repository";
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
    const url = new URL(request.url);
    const showAll = url.searchParams.get("admin")?.toLowerCase() === "true";

    const db = await getDatabaseProvider();
    const experiences = await getExperiences(db, showAll);
    return jsonResponse(experiences.map(formatExperienceDto), 200, request);
  } catch (error) {
    console.error("Failed to fetch experiences:", error);
    return jsonResponse({ error: String(error) }, 500, request);
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
    const company = typeof data.company === "string" ? data.company.trim() : "";

    if (!title || !company) {
      return jsonResponse(
        { error: "Title and company are required." },
        400,
        request,
      );
    }

    const responsibilities = parseCategoriesInput(data.responsibilities);
    const achievements = parseCategoriesInput(data.achievements);
    const technologies = parseCategoriesInput(data.technologies);

    const db = await getDatabaseProvider();
    const created = await createExperience(db, {
      title,
      company,
      location: typeof data.location === "string" ? data.location.trim() : "",
      start_date: normalizeDateInput(data.start_date),
      end_date: normalizeDateInput(data.end_date),
      is_current: Boolean(data.is_current),
      duration: typeof data.duration === "string" ? data.duration.trim() : "",
      responsibilities,
      achievements,
      technologies,
      color: typeof data.color === "string" ? data.color.trim() : "",
      order:
        data.order !== null && data.order !== undefined && data.order !== ""
          ? Number(data.order)
          : 0,
      is_visible: data.is_visible !== false,
    });

    return jsonResponse(
      {
        message: "Experience created successfully",
        experience: formatExperienceDto(created),
      },
      201,
      request,
    );
  } catch (error) {
    console.error("Create experience failed:", error);
    return jsonResponse({ error: String(error) }, 400, request);
  }
}
