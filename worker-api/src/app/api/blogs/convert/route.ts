import { requireAdmin } from "@/lib/auth/jwt";
import { handleOptions, jsonResponse } from "@/lib/http";
import {
  convertContentToHtml,
  AiConfigurationError,
  AiParseError,
} from "@/lib/integrations/gemini-service";

export const dynamic = "force-dynamic";

export async function OPTIONS(request: Request) {
  return handleOptions(request);
}

export async function POST(request: Request) {
  const auth = requireAdmin(request);
  if (!auth.authenticated) {
    return auth.response;
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { errors: { raw_text: ["raw_text is required."] } },
      400,
      request,
    );
  }

  const rawText = body.raw_text;
  if (typeof rawText !== "string" || !rawText) {
    return jsonResponse(
      { errors: { raw_text: ["raw_text is required."] } },
      400,
      request,
    );
  }

  if (rawText.length < 10 || rawText.length > 50000) {
    return jsonResponse(
      { errors: { raw_text: ["raw_text must be between 10 and 50,000 characters."] } },
      400,
      request,
    );
  }

  let customPrompt: string | null = null;
  if (typeof body.custom_system_prompt === "string") {
    if (body.custom_system_prompt.length > 10000) {
      return jsonResponse(
        { errors: { custom_system_prompt: ["custom_system_prompt too long (max 10,000 characters)."] } },
        400,
        request,
      );
    }
    customPrompt = body.custom_system_prompt;
  }

  try {
    const result = await convertContentToHtml(rawText, customPrompt);
    return jsonResponse(
      {
        html_content: result.html_content,
        suggested_title: result.suggested_title,
        suggested_excerpt: result.suggested_excerpt,
        reading_time_minutes: result.reading_time_minutes,
        suggested_quick_links: result.suggested_quick_links,
        suggested_tags: result.suggested_tags,
      },
      200,
      request,
    );
  } catch (err) {
    if (err instanceof AiConfigurationError) {
      return jsonResponse(
        { error: err.message },
        503,
        request,
      );
    }
    if (err instanceof AiParseError) {
      return jsonResponse(
        { error: err.message },
        502,
        request,
      );
    }
    return jsonResponse(
      { error: "AI conversion failed. Please try again." },
      500,
      request,
    );
  }
}
