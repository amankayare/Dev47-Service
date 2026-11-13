import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { GET as handleGetCategories, POST as handleCreateCategory } from "./route";
import { PUT as handleUpdateCategory, DELETE as handleDeleteCategory } from "./[id]/route";

describe("Blog Categories API Routes", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-category-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-categories-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
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

    adminToken = createJwtToken("admin", 1, true, "test-category-secret-key-47");
    userToken = createJwtToken("user", 2, false, "test-category-secret-key-47");
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

  it("lists empty categories initially", async () => {
    const req = new Request("http://localhost/api/blog-categories");
    const res = await handleGetCategories(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual([]);
  });

  it("requires admin to create a category", async () => {
    const req = new Request("http://localhost/api/blog-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ name: "Technology" }),
    });
    const res = await handleCreateCategory(req);
    expect(res.status).toBe(403);
  });

  it("validates required name on creation", async () => {
    const req = new Request("http://localhost/api/blog-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "   " }),
    });
    const res = await handleCreateCategory(req);
    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("Category name is required.");
  });

  it("creates a category and rejects duplicates", async () => {
    const req1 = new Request("http://localhost/api/blog-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Engineering" }),
    });
    const res1 = await handleCreateCategory(req1);
    expect(res1.status).toBe(201);
    const cat = (await res1.json()) as { id: number; name: string };
    expect(cat.name).toBe("Engineering");

    const req2 = new Request("http://localhost/api/blog-categories", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Engineering" }),
    });
    const res2 = await handleCreateCategory(req2);
    expect(res2.status).toBe(400);
    const err = (await res2.json()) as { error: string };
    expect(err.error).toBe("Category already exists.");
  });

  it("updates an existing category", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute("INSERT INTO blog_categories (name) VALUES (?)", ["DevOps"]);

    const req = new Request("http://localhost/api/blog-categories/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: "Cloud & DevOps" }),
    });
    const res = await handleUpdateCategory(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const updated = (await res.json()) as { id: number; name: string };
    expect(updated.name).toBe("Cloud & DevOps");
  });

  it("deletes a category and reassigns blogs to General", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute("INSERT INTO blog_categories (id, name) VALUES (1, 'Frontend')");
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id)
       VALUES (1, 'CSS Tricks', '<p>cool</p>', 1)`
    );

    const req = new Request("http://localhost/api/blog-categories/1", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    const res = await handleDeleteCategory(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(204);

    const remainingCats = await provider.query<{ id: number; name: string }>(
      "SELECT id, name FROM blog_categories"
    );
    expect(remainingCats.some((c) => c.name === "General")).toBe(true);
    expect(remainingCats.some((c) => c.name === "Frontend")).toBe(false);

    const generalCat = remainingCats.find((c) => c.name === "General");
    const blogRows = await provider.query<{ id: number; category_id: number }>(
      "SELECT id, category_id FROM blogs WHERE id = 1"
    );
    expect(blogRows[0].category_id).toBe(generalCat?.id);
  });
});
