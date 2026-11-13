import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { MemoryStorageProvider, setStorageProvider } from "@/lib/storage";
import { GET as handleGetResume } from "./route";
import { GET as handleViewResume } from "./view/route";
import { POST as handleUploadResume } from "./upload/route";
import { DELETE as handleDeleteResume } from "./delete/[filename]/route";
import { GET as handleDebugResume } from "./debug/route";

describe("Resume API Routes", () => {
  let dbFile: string;
  let userToken: string;
  let storage: MemoryStorageProvider;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-resume-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-resume-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );
    vi.stubEnv("DATABASE_URL", `sqlite:///${dbFile.replace(/\\/g, "/")}`);
    resetDatabaseProvider();

    storage = new MemoryStorageProvider();
    setStorageProvider(storage);

    const provider = await getDatabaseProvider();
    const migrationSql = fs.readFileSync(
      path.join(process.cwd(), "migrations", "sqlite", "0001_initial.sql"),
      "utf-8",
    );

    const statements = migrationSql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    for (const sql of statements) {
      await provider.execute(sql);
    }

    userToken = createJwtToken("admin", 1, true, "test-resume-secret-key-47");
  });

  afterEach(async () => {
    setStorageProvider(undefined);
    resetDatabaseProvider();
    vi.unstubAllEnvs();
    if (dbFile && fs.existsSync(dbFile)) {
      try {
        fs.unlinkSync(dbFile);
      } catch {
        // ignore
      }
    }
  });

  it("returns 404 when no resume configured", async () => {
    const req = new Request("http://localhost/api/resume");
    const res = await handleGetResume(req);
    expect(res.status).toBe(404);
  });

  it("redirects 302 for external resume URL", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO about (id, name, bio, resume_url)
       VALUES (1, 'Aman', 'Engineer', 'https://example.com/my-resume.pdf')`
    );

    const req = new Request("http://localhost/api/resume");
    const res = await handleGetResume(req);
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://example.com/my-resume.pdf");
  });

  it("uploads resume PDF and serves it", async () => {
    const pdfContent = new Uint8Array([37, 80, 68, 70]); // %PDF
    const formData = new FormData();
    formData.append(
      "file",
      new File([pdfContent], "my_cv.pdf", { type: "application/pdf" })
    );

    const uploadReq = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      body: formData,
    });

    const uploadRes = await handleUploadResume(uploadReq);
    expect(uploadRes.status).toBe(200);
    const data = (await uploadRes.json()) as { url: string; filename: string };
    expect(data.url).toMatch(/^\/static\/uploads\/resume_[a-f0-9]+\.pdf$/);

    // Save url into about table
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO about (id, name, bio, resume_url)
       VALUES (1, 'Aman', 'Engineer', ?)`,
      [data.url]
    );

    // Download resume
    const downloadReq = new Request("http://localhost/api/resume");
    const downloadRes = await handleGetResume(downloadReq);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("Content-Type")).toBe("application/pdf");
    expect(downloadRes.headers.get("Content-Disposition")).toContain("attachment");

    // View resume
    const viewReq = new Request("http://localhost/api/resume/view");
    const viewRes = await handleViewResume(viewReq);
    expect(viewRes.status).toBe(200);
    expect(viewRes.headers.get("Content-Disposition")).toBe("inline");

    // Debug resume
    const debugReq = new Request("http://localhost/api/resume/debug");
    const debugRes = await handleDebugResume(debugReq);
    expect(debugRes.status).toBe(200);
    const debugData = (await debugRes.json()) as any;
    expect(debugData.configured).toBe(true);
    expect(debugData.file_exists).toBe(true);

    // Delete resume
    const deleteReq = new Request(`http://localhost/api/resume/delete/${data.filename}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    const deleteRes = await handleDeleteResume(deleteReq, {
      params: Promise.resolve({ filename: data.filename }),
    });
    expect(deleteRes.status).toBe(200);

    const hasFile = await storage.has(data.filename);
    expect(hasFile).toBe(false);
  });

  it("rejects non-PDF uploads", async () => {
    const formData = new FormData();
    formData.append(
      "file",
      new File(["not a pdf"], "document.txt", { type: "text/plain" })
    );

    const uploadReq = new Request("http://localhost/api/resume/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
      body: formData,
    });

    const uploadRes = await handleUploadResume(uploadReq);
    expect(uploadRes.status).toBe(400);
    const data = (await uploadRes.json()) as { error: string };
    expect(data.error).toContain("Only PDF files are allowed");
  });
});
