import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { GET as handleGetDefaultPrompt } from "./convert/default-prompt/route";
import { POST as handleConvertContent } from "./convert/route";
import { DEFAULT_SYSTEM_PROMPT } from "@/lib/integrations/gemini-service";

describe("AI Convert Content Routes", () => {
  let adminToken: string;
  let userToken: string;

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-convert-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    adminToken = createJwtToken("admin", 1, true, "test-convert-secret-key-47");
    userToken = createJwtToken("user", 2, false, "test-convert-secret-key-47");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("handles GET /api/blogs/convert/default-prompt", async () => {
    const unauthReq = new Request("http://localhost/api/blogs/convert/default-prompt");
    const unauthRes = await handleGetDefaultPrompt(unauthReq);
    expect(unauthRes.status).toBe(401);

    const userReq = new Request("http://localhost/api/blogs/convert/default-prompt", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const userRes = await handleGetDefaultPrompt(userReq);
    expect(userRes.status).toBe(403);

    const adminReq = new Request("http://localhost/api/blogs/convert/default-prompt", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminRes = await handleGetDefaultPrompt(adminReq);
    expect(adminRes.status).toBe(200);
    const data = (await adminRes.json()) as { prompt: string };
    expect(data.prompt).toBe(DEFAULT_SYSTEM_PROMPT);
  });

  it("validates input on POST /api/blogs/convert", async () => {
    const emptyReq = new Request("http://localhost/api/blogs/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({}),
    });
    const emptyRes = await handleConvertContent(emptyReq);
    expect(emptyRes.status).toBe(400);

    const shortReq = new Request("http://localhost/api/blogs/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ raw_text: "too short" }),
    });
    const shortRes = await handleConvertContent(shortReq);
    expect(shortRes.status).toBe(400);
  });

  it("returns 503 when GEMINI_API_KEY is not configured", async () => {
    delete process.env.GEMINI_API_KEY;

    const req = new Request("http://localhost/api/blogs/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ raw_text: "This is long enough text for blog conversion testing." }),
    });
    const res = await handleConvertContent(req);
    expect(res.status).toBe(503);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Gemini API key is not configured");
  });

  it("successfully converts content with mocked Gemini API response", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fake-api-key");

    const mockAiResponse = {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  html_content: "<h2>Overview</h2><p>Here is converted HTML content.</p>",
                  suggested_title: "Mastering Next.js on Workers",
                  suggested_excerpt: "An in-depth guide on deploying Next.js edge workers.",
                  reading_time_minutes: 4,
                  suggested_quick_links: [{ title: "Overview", url: "#overview" }],
                  suggested_tags: ["nextjs", "cloudflare", "edge"],
                }),
              },
            ],
          },
        },
      ],
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockAiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = new Request("http://localhost/api/blogs/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        raw_text: "# Next.js\n\nDeploying Next.js on Cloudflare Workers using OpenNext.",
      }),
    });

    const res = await handleConvertContent(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.suggested_title).toBe("Mastering Next.js on Workers");
    expect(data.html_content).toContain("Overview");
    expect(data.suggested_tags).toEqual(["nextjs", "cloudflare", "edge"]);
    expect(fetchSpy).toHaveBeenCalled();
  });

  it("returns 502 when Gemini response is malformed JSON", async () => {
    vi.stubEnv("GEMINI_API_KEY", "fake-api-key");

    const mockAiResponse = {
      candidates: [
        {
          content: {
            parts: [{ text: "This is not valid JSON at all" }],
          },
        },
      ],
    };

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockAiResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = new Request("http://localhost/api/blogs/convert", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        raw_text: "Valid input content that is longer than ten characters.",
      }),
    });

    const res = await handleConvertContent(req);
    expect(res.status).toBe(502);
  });
});
