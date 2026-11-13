import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createJwtToken } from "@/lib/auth/jwt";
import { getDatabaseProvider, resetDatabaseProvider } from "@/lib/database";
import { GET as handleGetBlogs, POST as handleCreateBlog } from "./route";
import { GET as handleGetTest } from "./test/route";
import { GET as handleGetPopularTags } from "./tags/popular/route";
import { GET as handleGetPopularTagsSimple } from "./tags/popular/simple/route";
import { GET as handleGetAdminBlogs } from "./admin/route";
import {
  GET as handleGetBlogById,
  PUT as handleUpdateBlog,
  DELETE as handleDeleteBlog,
} from "./[id]/route";
import { GET as handleGetRelatedBlogs } from "./[id]/related/route";

describe("Blogs API Routes", () => {
  let dbFile: string;
  let adminToken: string;
  let userToken: string;

  beforeEach(async () => {
    vi.stubEnv("DATABASE_BACKEND", "SQLAlchemy");
    vi.stubEnv("JWT_SECRET", "test-blogs-secret-key-47");
    vi.stubEnv("JWT_EXP_MINUTES", "60");

    dbFile = path.join(
      process.cwd(),
      `test-blogs-${Date.now()}-${Math.random().toString(36).slice(2)}.sqlite`,
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

    // Seed category
    await provider.execute(
      "INSERT INTO blog_categories (id, name) VALUES (1, 'General'), (2, 'Tech')"
    );

    adminToken = createJwtToken("admin", 1, true, "test-blogs-secret-key-47");
    userToken = createJwtToken("user", 2, false, "test-blogs-secret-key-47");
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

  it("handles test endpoint", async () => {
    const req = new Request("http://localhost/api/blogs/test");
    const res = await handleGetTest(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { message: string };
    expect(data.message).toBe("Blogs blueprint is working!");
  });

  it("creates a blog and fetches it in visible blogs", async () => {
    const createReq = new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Cloudflare Workers & Next.js",
        excerpt: "A deep dive into edge computing.",
        content: "<h2>Introduction</h2><p>Here is content.</p>",
        category_id: 2,
        author: { name: "Aman Kayare" },
        tags: ["Cloudflare", "Next.js"],
        featured: true,
        reading_time: 5,
        quick_links: [{ title: "Docs", url: "https://developers.cloudflare.com" }],
      }),
    });

    const createRes = await handleCreateBlog(createReq);
    expect(createRes.status).toBe(201);
    const blog = (await createRes.json()) as any;
    expect(blog.title).toBe("Cloudflare Workers & Next.js");
    expect(blog.category.name).toBe("Tech");
    expect(blog.author.name).toBe("Aman Kayare");
    expect(blog.tags).toHaveLength(2);
    expect(blog.featured).toBe(true);

    const getReq = new Request("http://localhost/api/blogs");
    const getRes = await handleGetBlogs(getReq);
    expect(getRes.status).toBe(200);
    const blogs = (await getRes.json()) as any[];
    expect(blogs).toHaveLength(1);
    expect(blogs[0].title).toBe("Cloudflare Workers & Next.js");
  });

  it("gets a single blog by id and handles 404", async () => {
    const req404 = new Request("http://localhost/api/blogs/999");
    const res404 = await handleGetBlogById(req404, { params: Promise.resolve({ id: "999" }) });
    expect(res404.status).toBe(404);

    const createReq = new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Test Single Blog",
        content: "<p>Content</p>",
        category_id: 1,
        author: { name: "Author 1" },
      }),
    });
    const createRes = await handleCreateBlog(createReq);
    const created = (await createRes.json()) as any;

    const req = new Request(`http://localhost/api/blogs/${created.id}`);
    const res = await handleGetBlogById(req, { params: Promise.resolve({ id: String(created.id) }) });
    expect(res.status).toBe(200);
    const fetched = (await res.json()) as any;
    expect(fetched.id).toBe(created.id);
  });

  it("updates a blog when admin", async () => {
    const createReq = new Request("http://localhost/api/blogs", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Initial Title",
        content: "<p>Old Content</p>",
        category_id: 1,
        author: { name: "Author 1" },
      }),
    });
    const createRes = await handleCreateBlog(createReq);
    const created = (await createRes.json()) as any;

    const updateReq = new Request(`http://localhost/api/blogs/${created.id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: "Updated Title",
        content: "<p>New Content</p>",
        tags: ["UpdatedTag"],
      }),
    });
    const updateRes = await handleUpdateBlog(updateReq, { params: Promise.resolve({ id: String(created.id) }) });
    expect(updateRes.status).toBe(200);
    const updated = (await updateRes.json()) as any;
    expect(updated.title).toBe("Updated Title");
    expect(updated.content).toBe("<p>New Content</p>");
    expect(updated.tags[0].name).toBe("UpdatedTag");
  });

  it("deletes a blog and removes its comments", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id)
       VALUES (1, 'Blog to Delete', '<p>Bye</p>', 1)`
    );
    await provider.execute(
      `INSERT INTO users (id, username, email, password_hash)
       VALUES (10, 'alice', 'alice@test.com', 'hash')`
    );
    await provider.execute(
      `INSERT INTO comments (id, content, author_id, blog_id)
       VALUES (100, 'Comment on deleted blog', 10, 1)`
    );

    const deleteReq = new Request("http://localhost/api/blogs/1", {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });
    const deleteRes = await handleDeleteBlog(deleteReq, { params: Promise.resolve({ id: "1" }) });
    expect(deleteRes.status).toBe(204);

    const blogs = await provider.query<{ id: number }>("SELECT id FROM blogs WHERE id = 1");
    expect(blogs).toHaveLength(0);
    const comments = await provider.query<{ id: number }>("SELECT id FROM comments WHERE blog_id = 1");
    expect(comments).toHaveLength(0);
  });

  it("handles popular tags and simple popular tags", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute("INSERT INTO tags (id, name) VALUES (1, 'React'), (2, 'TypeScript')");
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id, is_visible)
       VALUES (1, 'Blog 1', 'Content 1', 1, 1),
              (2, 'Blog 2', 'Content 2', 1, 1)`
    );
    await provider.execute(
      `INSERT INTO blog_tags (blog_id, tag_id)
       VALUES (1, 1), (1, 2), (2, 1)`
    );

    const req = new Request("http://localhost/api/blogs/tags/popular");
    const res = await handleGetPopularTags(req);
    expect(res.status).toBe(200);
    const data = (await res.json()) as any;
    expect(data.total_blogs).toBe(2);
    expect(data.popular_tags[0].name).toBe("React");
    expect(data.popular_tags[0].count).toBe(2);
    expect(data.popular_tags[0].percentage).toBe(100);

    const simpleReq = new Request("http://localhost/api/blogs/tags/popular/simple");
    const simpleRes = await handleGetPopularTagsSimple(simpleReq);
    expect(simpleRes.status).toBe(200);
    const simpleData = (await simpleRes.json()) as any;
    expect(simpleData.popular_tags[0].id).toBe(0);
  });

  it("handles admin blog listing with filters and pagination", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id, is_visible)
       VALUES (1, 'Alpha Post', 'Alpha content', 1, 1),
              (2, 'Beta Post', 'Beta content', 1, 0),
              (3, 'Gamma Post', 'Gamma content', 1, 1)`
    );

    // List all
    const reqAll = new Request("http://localhost/api/blogs/admin?page=1&page_size=2", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resAll = await handleGetAdminBlogs(reqAll);
    expect(resAll.status).toBe(200);
    const dataAll = (await resAll.json()) as any;
    expect(dataAll.total).toBe(3);
    expect(dataAll.blogs).toHaveLength(2);
    expect(dataAll.counts.all).toBe(3);
    expect(dataAll.counts.visible).toBe(2);
    expect(dataAll.counts.hidden).toBe(1);

    // Filter hidden
    const reqHidden = new Request("http://localhost/api/blogs/admin?status=hidden", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resHidden = await handleGetAdminBlogs(reqHidden);
    const dataHidden = (await resHidden.json()) as any;
    expect(dataHidden.total).toBe(1);
    expect(dataHidden.blogs[0].title).toBe("Beta Post");

    // Search
    const reqSearch = new Request("http://localhost/api/blogs/admin?search=Gamma", {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const resSearch = await handleGetAdminBlogs(reqSearch);
    const dataSearch = (await resSearch.json()) as any;
    expect(dataSearch.total).toBe(1);
    expect(dataSearch.blogs[0].title).toBe("Gamma Post");
  });

  it("returns related blogs", async () => {
    const provider = await getDatabaseProvider();
    await provider.execute("INSERT INTO tags (id, name) VALUES (1, 'Docker'), (2, 'Kubernetes')");
    await provider.execute(
      `INSERT INTO blogs (id, title, content, category_id, is_visible)
       VALUES (1, 'Main Blog', 'Content', 1, 1),
              (2, 'Related Blog', 'Content', 1, 1),
              (3, 'Unrelated Blog', 'Content', 1, 1)`
    );
    await provider.execute("INSERT INTO blog_tags (blog_id, tag_id) VALUES (1, 1), (2, 1)");

    const req = new Request("http://localhost/api/blogs/1/related");
    const res = await handleGetRelatedBlogs(req, { params: Promise.resolve({ id: "1" }) });
    expect(res.status).toBe(200);
    const related = (await res.json()) as any[];
    expect(related.some((b) => b.id === 2)).toBe(true);
    expect(related.some((b) => b.id === 1)).toBe(false);
  });
});
