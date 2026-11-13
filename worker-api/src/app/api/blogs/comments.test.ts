import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import {
  GET as handleGetComments,
  POST as handleCreateComment,
} from "./[id]/comments/route";
import {
  PUT as handleUpdateComment,
  DELETE as handleDeleteComment,
} from "../comments/[id]/route";

describe("Comments API Routes", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken1: string;
  let userToken2: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-comments-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-comments-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
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

    // Seed users
    await provider.execute(
      `INSERT INTO users (id, username, email, password_hash, is_admin)
       VALUES (1, 'admin', 'admin@example.com', 'dummyhash', 1),
              (2, 'alice', 'alice@example.com', 'dummyhash', 0),
              (3, 'bob', 'bob@example.com', 'dummyhash', 0)`
    );

    // Seed category and blog
    await provider.execute(
      "INSERT INTO blog_categories (id, name) VALUES (1, 'General')"
    );
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id)
       VALUES (1, 'Test Blog', '<p>Hello</p>', 1)`
    );

    adminToken = createJwtToken("admin", 1, true, "test-comments-secret-key-47");
    userToken1 = createJwtToken("alice", 2, false, "test-comments-secret-key-47");
    userToken2 = createJwtToken("bob", 3, false, "test-comments-secret-key-47");
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

  it("returns 404 for comments on non-existent blog", async () => {
    const req = new Request("http://localhost/api/blogs/999/comments");
    const res = await handleGetComments(req, { params: Promise.resolve({ id: "999" }) });
    expect(res.status).toBe(404);
  });

  it("creates a top-level comment and fetches it", async () => {
    const postReq = new Request("http://localhost/api/blogs/1/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken1}`,
      },
      body: JSON.stringify({ content: "Great article!" }),
    });
    const postRes = await handleCreateComment(postReq, { params: Promise.resolve({ id: "1" }) });
    expect(postRes.status).toBe(201);
    const created = (await postRes.json()) as { id: number; content: string; author: { username: string } };
    expect(created.content).toBe("Great article!");
    expect(created.author.username).toBe("alice");

    const getReq = new Request("http://localhost/api/blogs/1/comments");
    const getRes = await handleGetComments(getReq, { params: Promise.resolve({ id: "1" }) });
    expect(getRes.status).toBe(200);
    const comments = (await getRes.json()) as Array<{ id: number; content: string; replies: unknown[] }>;
    expect(comments).toHaveLength(1);
    expect(comments[0].content).toBe("Great article!");
    expect(comments[0].replies).toHaveLength(0);
  });

  it("creates nested replies and returns hierarchy", async () => {
    const provider = await getDatabaseProvider();
    // Insert parent comment
    await provider.execute(
      `INSERT INTO comments (id, content, author_id, blog_id, parent_id)
       VALUES (1, 'Parent comment', 2, 1, NULL)`
    );

    const replyReq = new Request("http://localhost/api/blogs/1/comments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken2}`,
      },
      body: JSON.stringify({ content: "Reply by Bob", parent_id: 1 }),
    });
    const replyRes = await handleCreateComment(replyReq, { params: Promise.resolve({ id: "1" }) });
    expect(replyRes.status).toBe(201);

    const getReq = new Request("http://localhost/api/blogs/1/comments");
    const getRes = await handleGetComments(getReq, { params: Promise.resolve({ id: "1" }) });
    expect(getRes.status).toBe(200);
    const comments = (await getRes.json()) as Array<{ id: number; content: string; replies: Array<{ id: number; content: string }> }>;
    expect(comments).toHaveLength(1);
    expect(comments[0].id).toBe(1);
    expect(comments[0].replies).toHaveLength(1);
    expect(comments[0].replies[0].content).toBe("Reply by Bob");
  });

  it("updates a comment when author or admin", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO comments (id, content, author_id, blog_id)
       VALUES (1, 'Original comment', 2, 1)`
    );

    // Non-author user2 cannot edit
    const unauthorizedReq = new Request("http://localhost/api/comments/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken2}`,
      },
      body: JSON.stringify({ content: "Hacked comment" }),
    });
    const unauthorizedRes = await handleUpdateComment(unauthorizedReq, { params: Promise.resolve({ id: "1" }) });
    expect(unauthorizedRes.status).toBe(403);

    // Author user1 can edit
    const authorReq = new Request("http://localhost/api/comments/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken1}`,
      },
      body: JSON.stringify({ content: "Updated by author" }),
    });
    const authorRes = await handleUpdateComment(authorReq, { params: Promise.resolve({ id: "1" }) });
    expect(authorRes.status).toBe(200);

    // Admin can also edit
    const adminReq = new Request("http://localhost/api/comments/1", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ content: "Moderated by admin" }),
    });
    const adminRes = await handleUpdateComment(adminReq, { params: Promise.resolve({ id: "1" }) });
    expect(adminRes.status).toBe(200);
  });

  it("deletes a comment and its nested replies recursively", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO comments (id, content, author_id, blog_id, parent_id)
       VALUES (1, 'Root', 2, 1, NULL),
              (2, 'Child 1', 3, 1, 1),
              (3, 'Child 2', 2, 1, 2)`
    );

    const deleteReq = new Request("http://localhost/api/comments/1", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userToken1}`,
      },
    });
    const deleteRes = await handleDeleteComment(deleteReq, { params: Promise.resolve({ id: "1" }) });
    expect(deleteRes.status).toBe(200);

    const remaining = await provider.query<{ id: number }>("SELECT id FROM comments");
    expect(remaining).toHaveLength(0);
  });
});
