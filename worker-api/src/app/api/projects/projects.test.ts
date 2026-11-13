import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { GET as handleGetProjects, POST as handleCreateProject } from "./route";
import { GET as handleGetFeatured } from "./featured/route";
import { GET as handleGetAdminProjects } from "./admin/route";
import {
  GET as handleGetProjectById,
  PUT as handleUpdateProject,
  DELETE as handleDeleteProject,
} from "./[id]/route";

describe("Projects API Routes", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-project-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-projects-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
    );
    vi.stubEnv("DATABASE_URL", `sqlite:///${dbFile.replace(/\\/g, "/")}`);
    resetDatabaseProvider();

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

    adminToken = createJwtToken("admin", 1, true, "test-project-secret-key-47");
    userToken = createJwtToken("user", 2, false, "test-project-secret-key-47");
  });

  afterEach(async () => {
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

  describe("POST /api/projects", () => {
    it("rejects non-admin or unauthenticated requests", async () => {
      // Unauthenticated
      const noAuthRes = await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "P1", description: "D1" }),
        }),
      );
      expect(noAuthRes.status).toBe(401);

      // Non-admin user
      const userRes = await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({ title: "P1", description: "D1" }),
        }),
      );
      expect(userRes.status).toBe(403);
    });

    it("validates required title and description", async () => {
      const res = await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({ title: "", description: "" }),
        }),
      );
      expect(res.status).toBe(400);
      const data = (await res.json()) as Record<string, any>;
      expect(data.errors).toBeDefined();
    });

    it("creates a project with full metadata", async () => {
      const payload = {
        title: "Portfolio Service",
        description: "Cloudflare Workers Next.js API",
        tech_stack: ["TypeScript", "Next.js", "Cloudflare D1"],
        links: [
          { name: "GitHub", url: "https://github.com/example/repo" },
          { name: "Live", url: "https://example.com" },
        ],
        image: "https://example.com/cover.png",
        gallery: ["https://example.com/1.png", "https://example.com/2.png"],
        project_type: "Full Stack",
        start_date: "2024-01-01",
        end_date: "2024-06-30",
        role: "Lead Architect",
        team_size: 3,
        categories: [{ name: "Web Dev" }, { name: "Cloud" }],
        is_visible: true,
        is_featured: true,
        order: 1,
      };

      const res = await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify(payload),
        }),
      );
      expect(res.status).toBe(201);
      const data = (await res.json()) as Record<string, any>;
      expect(data.id).toBeGreaterThan(0);
      expect(data.title).toBe("Portfolio Service");
      expect(data.tech).toEqual(["TypeScript", "Next.js", "Cloudflare D1"]);
      expect(data.links).toEqual([
        { name: "GitHub", url: "https://github.com/example/repo" },
        { name: "Live", url: "https://example.com" },
      ]);
      expect(data.categories).toEqual(["Web Dev", "Cloud"]);
      expect(data.is_visible).toBe(true);
      expect(data.is_featured).toBe(true);
      expect(data.order).toBe(1);
      expect(data.start_date).toBe("2024-01-01");
      expect(data.end_date).toBe("2024-06-30");
    });
  });

  describe("GET /api/projects and /api/projects/featured", () => {
    beforeEach(async () => {
      // Create 3 projects:
      // 1: visible=1, featured=1, order=2
      // 2: visible=1, featured=0, order=1
      // 3: visible=0, featured=1, order=0 (hidden)
      const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      };

      await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "Project Visible & Featured",
            description: "P1",
            is_visible: true,
            is_featured: true,
            order: 2,
          }),
        }),
      );

      await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "Project Visible Not Featured",
            description: "P2",
            is_visible: true,
            is_featured: false,
            order: 1,
          }),
        }),
      );

      await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers,
          body: JSON.stringify({
            title: "Project Hidden",
            description: "P3",
            is_visible: false,
            is_featured: true,
            order: 0,
          }),
        }),
      );
    });

    it("GET /api/projects returns only visible projects sorted by order asc", async () => {
      const res = await handleGetProjects(new Request("http://localhost:3000/api/projects"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<Record<string, any>>;
      expect(data.length).toBe(2);
      expect(data[0].title).toBe("Project Visible Not Featured"); // order 1
      expect(data[1].title).toBe("Project Visible & Featured"); // order 2
    });

    it("GET /api/projects/featured returns only visible featured projects", async () => {
      const res = await handleGetFeatured(new Request("http://localhost:3000/api/projects/featured"));
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<Record<string, any>>;
      expect(data.length).toBe(1);
      expect(data[0].title).toBe("Project Visible & Featured");
    });

    it("GET /api/projects/admin returns all projects including hidden ones", async () => {
      const res = await handleGetAdminProjects(
        new Request("http://localhost:3000/api/projects/admin", {
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Array<Record<string, any>>;
      expect(data.length).toBe(3);
      expect(data[0].title).toBe("Project Hidden"); // order 0
      expect(data[1].title).toBe("Project Visible Not Featured"); // order 1
      expect(data[2].title).toBe("Project Visible & Featured"); // order 2
    });
  });

  describe("PUT & DELETE /api/projects/[id]", () => {
    let createdId: number;

    beforeEach(async () => {
      const res = await handleCreateProject(
        new Request("http://localhost:3000/api/projects", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${adminToken}`,
          },
          body: JSON.stringify({
            title: "Original Project",
            description: "Original Description",
            tech: ["Python"],
            is_visible: true,
            order: 5,
          }),
        }),
      );
      const data = (await res.json()) as Record<string, any>;
      createdId = data.id;
    });

    it("GET /api/projects/[id] returns project details", async () => {
      const res = await handleGetProjectById(
        new Request(`http://localhost:3000/api/projects/${createdId}`),
        { params: Promise.resolve({ id: String(createdId) }) },
      );
      expect(res.status).toBe(200);
      const data = (await res.json()) as Record<string, any>;
      expect(data.title).toBe("Original Project");
      expect(data.tech).toEqual(["Python"]);
    });

    it("PUT updates project with user JWT", async () => {
      const updateRes = await handleUpdateProject(
        new Request(`http://localhost:3000/api/projects/${createdId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${userToken}`,
          },
          body: JSON.stringify({
            title: "Updated Project Title",
            tech: ["TypeScript", "Vitest"],
            is_featured: true,
          }),
        }),
        { params: Promise.resolve({ id: String(createdId) }) },
      );
      expect(updateRes.status).toBe(200);
      const data = (await updateRes.json()) as Record<string, any>;
      expect(data.title).toBe("Updated Project Title");
      expect(data.tech).toEqual(["TypeScript", "Vitest"]);
      expect(data.is_featured).toBe(true);
      expect(data.description).toBe("Original Description"); // preserved
    });

    it("DELETE removes project (admin only)", async () => {
      // Non-admin fails
      const userDel = await handleDeleteProject(
        new Request(`http://localhost:3000/api/projects/${createdId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${userToken}` },
        }),
        { params: Promise.resolve({ id: String(createdId) }) },
      );
      expect(userDel.status).toBe(403);

      // Admin succeeds
      const adminDel = await handleDeleteProject(
        new Request(`http://localhost:3000/api/projects/${createdId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${adminToken}` },
        }),
        { params: Promise.resolve({ id: String(createdId) }) },
      );
      expect(adminDel.status).toBe(204);

      // Subsequent GET returns 404
      const getRes = await handleGetProjectById(
        new Request(`http://localhost:3000/api/projects/${createdId}`),
        { params: Promise.resolve({ id: String(createdId) }) },
      );
      expect(getRes.status).toBe(404);
    });
  });
});
