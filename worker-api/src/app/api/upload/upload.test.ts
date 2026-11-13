import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { MemoryStorageProvider, setStorageProvider } from "@/lib/storage";
import { POST as handleUploadFile } from "./[upload_type]/route";
import { DELETE as handleDeleteFile } from "./delete/[filename]/route";
import { GET as handleServeUpload } from "@/app/static/uploads/[filename]/route";

describe("Upload API Routes", () => {
  let userToken: string;
  let storage: MemoryStorageProvider;

  beforeEach(() => {
    vi.stubEnv("JWT_SECRET", "test-upload-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    storage = new MemoryStorageProvider();
    setStorageProvider(storage);

    userToken = createJwtToken("alice", 2, false, "test-upload-secret-key-47");
  });

  afterEach(() => {
    setStorageProvider(undefined);
    vi.unstubAllEnvs();
  });

  it("validates upload type", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File(["img"], "pic.png", { type: "image/png" })
    );

    const req = new Request("http://localhost/api/upload/invalid_type", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });
    const res = await handleUploadFile(req, {
      params: Promise.resolve({ upload_type: "invalid_type" }),
    });
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toContain("Invalid upload type");
  });

  it("uploads an image and serves it via /static/uploads/[filename]", async () => {
    const imageBytes = new Uint8Array([137, 80, 78, 71]); // PNG magic bytes
    const formData = new FormData();
    formData.append(
      "file",
      new File([imageBytes], "photo.png", { type: "image/png" })
    );

    const uploadReq = new Request("http://localhost/api/upload/profile", {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });
    const uploadRes = await handleUploadFile(uploadReq, {
      params: Promise.resolve({ upload_type: "profile" }),
    });
    expect(uploadRes.status).toBe(200);
    const uploadData = (await uploadRes.json()) as { url: string; filename: string };
    expect(uploadData.filename).toMatch(/^profile_[a-f0-9]+\.png$/);

    // Fetch via static route
    const serveReq = new Request(`http://localhost${uploadData.url}`);
    const serveRes = await handleServeUpload(serveReq, {
      params: Promise.resolve({ filename: uploadData.filename }),
    });
    expect(serveRes.status).toBe(200);
    expect(serveRes.headers.get("Content-Type")).toBe("image/png");

    // Delete uploaded image
    const deleteReq = new Request(`http://localhost/api/upload/delete/${uploadData.filename}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const deleteRes = await handleDeleteFile(deleteReq, {
      params: Promise.resolve({ filename: uploadData.filename }),
    });
    expect(deleteRes.status).toBe(200);

    const hasFile = await storage.has(uploadData.filename);
    expect(hasFile).toBe(false);
  });

  it("rejects invalid delete filenames", async () => {
    const req = new Request("http://localhost/api/upload/delete/malicious.txt", {
      method: "DELETE",
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const res = await handleDeleteFile(req, {
      params: Promise.resolve({ filename: "malicious.txt" }),
    });
    expect(res.status).toBe(400);
  });
});
