import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { POST as handleStageAsset } from "./stage/route";
import { DELETE as handleDeleteStaged } from "./stage/[id]/route";
import { GET as handlePreviewStaged } from "./stage/[id]/preview/route";
import { POST as handleConfirmAsset } from "./confirm/[id]/route";

describe("Polyglot Storage API Routes", () => {
  let userToken: string;

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-polyglot-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    userToken = createJwtToken("alice", 2, false, "test-polyglot-secret-key-47");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 500 when Polyglot is not configured", async () => {
    delete process.env.POLYGLOT_URL;
    delete process.env.POLYGLOT_API_KEY;

    const formData = new FormData();
    formData.append("file", new File(["test"], "asset.png", { type: "image/png" }));

    const req = new Request("http://localhost/api/polyglot/stage", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });
    const res = await handleStageAsset(req);
    expect(res.status).toBe(500);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Polyglot Storage is not configured");
  });

  it("stages an asset and rewrites previewUrl", async () => {
    vi.stubEnv("POLYGLOT_URL", "https://polyglot.example.com");
    vi.stubEnv("POLYGLOT_API_KEY", "test-polyglot-key");

    const mockUpstreamResponse = {
      success: true,
      data: {
        stageId: "stage-12345",
        previewUrl: "https://polyglot.example.com/preview/raw",
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockUpstreamResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const formData = new FormData();
    formData.append("file", new File(["bytes"], "cover.jpg", { type: "image/jpeg" }));

    const req = new Request("http://localhost/api/polyglot/stage", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });
    const res = await handleStageAsset(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.success).toBe(true);
    expect(data.data.stageId).toBe("stage-12345");
    expect(data.data.previewUrl).toBe("/api/polyglot/stage/stage-12345/preview");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://polyglot.example.com/api/v1/assets/stage",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "x-api-key": "test-polyglot-key",
        }),
      })
    );
  });

  it("proxies asset preview with token in query param", async () => {
    vi.stubEnv("POLYGLOT_URL", "https://polyglot.example.com");
    vi.stubEnv("POLYGLOT_API_KEY", "test-polyglot-key");

    const imageBytes = new Uint8Array([1, 2, 3, 4]);
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(imageBytes, {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      })
    );

    const req = new Request(`http://localhost/api/polyglot/stage/stage-12345/preview?jwt=${userToken}`);
    const res = await handlePreviewStaged(req, {
      params: Promise.resolve({ id: "stage-12345" }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/jpeg");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes).toEqual(imageBytes);
  });

  it("confirms an asset with provider", async () => {
    vi.stubEnv("POLYGLOT_URL", "https://polyglot.example.com");
    vi.stubEnv("POLYGLOT_API_KEY", "test-polyglot-key");

    const mockConfirmResponse = {
      success: true,
      data: {
        publicUrl: "https://raw.githubusercontent.com/user/repo/main/asset.jpg",
      },
    };

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(mockConfirmResponse), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = new Request("http://localhost/api/polyglot/confirm/stage-12345", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ provider: "github" }),
    });
    const res = await handleConfirmAsset(req, {
      params: Promise.resolve({ id: "stage-12345" }),
    });
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.data.publicUrl).toContain("githubusercontent");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://polyglot.example.com/api/v1/assets/stage/stage-12345/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ provider: "github" }),
      })
    );
  });

  it("discards a staged asset", async () => {
    vi.stubEnv("POLYGLOT_URL", "https://polyglot.example.com");
    vi.stubEnv("POLYGLOT_API_KEY", "test-polyglot-key");

    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true, message: "Asset discarded" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const req = new Request("http://localhost/api/polyglot/stage/stage-12345", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    const res = await handleDeleteStaged(req, {
      params: Promise.resolve({ id: "stage-12345" }),
    });
    expect(res.status).toBe(200);
  });
});
