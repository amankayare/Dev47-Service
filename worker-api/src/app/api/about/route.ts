import { authenticateRequest } from "@/lib/auth/jwt";
import { getDatabaseProvider } from "@/lib/database";
import { handleOptions, jsonResponse, parseJsonBody } from "@/lib/http";
import {
  createAbout,
  deleteAbout,
  formatAboutDto,
  getAbout,
  updateAbout,
} from "@/lib/about/about-repository";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request): Promise<Response> {
  return handleOptions(request);
}

export async function GET(request: Request): Promise<Response> {
  try {
    const db = await getDatabaseProvider();
    const about = await getAbout(db);
    if (!about) {
      return jsonResponse({}, 200, request);
    }
    return jsonResponse(formatAboutDto(about), 200, request);
  } catch (error) {
    console.error("Failed to fetch about:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}

export async function POST(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getAbout(db);
    if (existing) {
      return jsonResponse(
        { error: "About info already exists. Use PUT to update." },
        400,
        request,
      );
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const name = typeof data.name === "string" ? data.name.trim() : "";
    const bio = typeof data.bio === "string" ? data.bio.trim() : "";

    const created = await createAbout(db, {
      name,
      headline:
        typeof data.headline === "string" ? data.headline.trim() : "",
      bio,
      photo: typeof data.photo === "string" ? data.photo.trim() : "",
      cover_image:
        typeof data.cover_image === "string" ? data.cover_image.trim() : "",
      location:
        typeof data.location === "string" ? data.location.trim() : "",
      email: typeof data.email === "string" ? data.email.trim() : "",
      phone: typeof data.phone === "string" ? data.phone.trim() : "",
      resume_url:
        typeof data.resume_url === "string" ? data.resume_url.trim() : "",
      social_links: (data.social_links as Record<string, unknown>) ?? {},
    });

    return jsonResponse(formatAboutDto(created), 201, request);
  } catch (error) {
    console.error("Create about failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    const existing = await getAbout(db);
    if (!existing) {
      return jsonResponse({ error: "About info not found" }, 404, request);
    }

    const data = (await parseJsonBody<Record<string, unknown>>(request)) ?? {};
    const updateParams: Record<string, unknown> = {};

    for (const field of [
      "name",
      "headline",
      "bio",
      "photo",
      "cover_image",
      "location",
      "email",
      "phone",
      "resume_url",
    ]) {
      if (data[field] !== undefined) {
        updateParams[field] =
          typeof data[field] === "string" ? (data[field] as string).trim() : "";
      }
    }
    if (data.social_links !== undefined) {
      updateParams.social_links = data.social_links;
    }

    const updated = await updateAbout(db, updateParams);
    if (!updated) {
      return jsonResponse({ error: "About info not found" }, 404, request);
    }

    return jsonResponse(formatAboutDto(updated), 200, request);
  } catch (error) {
    console.error("Update about failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = authenticateRequest(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  try {
    const db = await getDatabaseProvider();
    await deleteAbout(db);
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": request.headers.get("origin") ?? "*",
        "Access-Control-Allow-Credentials": "true",
      },
    });
  } catch (error) {
    console.error("Delete about failed:", error);
    return jsonResponse({ errors: String(error) }, 400, request);
  }
}
