import { requireAdmin } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  formatProjectDto,
  getAllProjects,
} from "@/lib/projects/project-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    const projects = await getAllProjects(db);
    return jsonResponse(projects.map(formatProjectDto), 200, request);
  } catch (error) {
    console.error("Failed to fetch admin projects:", error);
    return jsonResponse([], 500, request);
  }
}
