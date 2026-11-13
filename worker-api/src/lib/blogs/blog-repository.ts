import { formatIsoDate } from "@/lib/auth/user-repository";
import type { DatabaseProvider, SqlValue } from "@/lib/database/types";
import { parseJsonField, serializeJsonField } from "@/lib/projects/project-repository";
import { getBlogCategoryById } from "./blog-category-repository";

export interface BlogRecord extends Record<string, unknown> {
  id: number;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  date: string | Date | null;
  reading_time: number | null;
  featured: boolean | number;
  is_visible: boolean | number;
  quick_links: string | Array<{ title: string; url: string }> | null;
  category_id: number;
  author_id: number | null;
}

export interface TagRecord extends Record<string, unknown> {
  id: number;
  name: string;
}

export interface AuthorRecord extends Record<string, unknown> {
  id: number;
  name: string;
  email: string | null;
}

export interface BlogDto {
  id: number;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image: string | null;
  date: string | null;
  reading_time: number | null;
  featured: boolean;
  is_visible: boolean;
  quick_links: Array<{ title: string; url: string }> | null;
  category_id: number;
  category: { id: number; name: string } | null;
  author_id: number | null;
  author: { id: number; name: string; email: string | null } | null;
  tags: Array<{ id: number; name: string }>;
}

export interface CreateBlogInput {
  title: string;
  excerpt?: string | null;
  content: string;
  cover_image?: string | null;
  date?: string | Date | null;
  reading_time?: number | null;
  featured?: boolean | string;
  is_visible?: boolean | string;
  quick_links?: Array<{ title: string; url: string }> | null;
  category_id: number;
  author: { id?: number; name: string };
  tags?: Array<string | { id?: number; name?: string }>;
}

export interface UpdateBlogInput {
  title?: string;
  excerpt?: string | null;
  content?: string;
  cover_image?: string | null;
  date?: string | Date | null;
  reading_time?: number | null;
  featured?: boolean | string;
  is_visible?: boolean | string;
  quick_links?: Array<{ title: string; url: string }> | null;
  category_id?: number;
  author?: { id?: number; name: string };
  tags?: Array<string | { id?: number; name?: string }>;
}

export async function findOrCreateAuthor(
  db: DatabaseProvider,
  authorInput: { id?: number; name?: string },
): Promise<AuthorRecord> {
  if (authorInput.id) {
    const rows = await db.query<AuthorRecord>(
      "SELECT id, name, email FROM authors WHERE id = ?",
      [authorInput.id],
    );
    if (rows[0]) return rows[0];
  }

  const name = authorInput.name?.trim() ?? "";
  if (!name) {
    throw new Error("Author is required and must have a name.");
  }

  const existingByName = await db.query<AuthorRecord>(
    "SELECT id, name, email FROM authors WHERE name = ?",
    [name],
  );
  if (existingByName[0]) return existingByName[0];

  const result = await db.execute(
    "INSERT INTO authors (name) VALUES (?)",
    [name],
  );

  const insertId =
    result.lastInsertRowId ??
    (await db.query<{ id: number }>(
      "SELECT id FROM authors WHERE name = ?",
      [name],
    ))[0]?.id;

  const created = await db.query<AuthorRecord>(
    "SELECT id, name, email FROM authors WHERE id = ?",
    [insertId],
  );
  if (!created[0]) {
    throw new Error("Failed to create author");
  }
  return created[0];
}

export async function findOrCreateTags(
  db: DatabaseProvider,
  tagsInput: Array<string | { id?: number; name?: string }>,
): Promise<TagRecord[]> {
  const result: TagRecord[] = [];
  const seenTagIds = new Set<number>();

  for (const item of tagsInput) {
    let tagId: number | undefined;
    let tagName: string | undefined;

    if (typeof item === "object" && item !== null) {
      tagId = item.id;
      tagName = item.name?.trim();
    } else if (typeof item === "string") {
      tagName = item.trim();
    }

    let foundTag: TagRecord | undefined;
    if (tagId) {
      const rows = await db.query<TagRecord>(
        "SELECT id, name FROM tags WHERE id = ?",
        [tagId],
      );
      if (rows[0]) foundTag = rows[0];
    }

    if (!foundTag && tagName) {
      const rows = await db.query<TagRecord>(
        "SELECT id, name FROM tags WHERE name = ?",
        [tagName],
      );
      if (rows[0]) foundTag = rows[0];
    }

    if (!foundTag && tagName) {
      const insertResult = await db.execute(
        "INSERT INTO tags (name) VALUES (?)",
        [tagName],
      );
      const insertId =
        insertResult.lastInsertRowId ??
        (await db.query<{ id: number }>(
          "SELECT id FROM tags WHERE name = ?",
          [tagName],
        ))[0]?.id;

      const created = await db.query<TagRecord>(
        "SELECT id, name FROM tags WHERE id = ?",
        [insertId],
      );
      if (created[0]) foundTag = created[0];
    }

    if (foundTag && !seenTagIds.has(foundTag.id)) {
      seenTagIds.add(foundTag.id);
      result.push(foundTag);
    }
  }

  return result;
}

export async function syncBlogTags(
  db: DatabaseProvider,
  blogId: number,
  tags: TagRecord[],
): Promise<void> {
  await db.execute("DELETE FROM blog_tags WHERE blog_id = ?", [blogId]);
  for (const tag of tags) {
    await db.execute(
      "INSERT INTO blog_tags (blog_id, tag_id) VALUES (?, ?)",
      [blogId, tag.id],
    );
  }
}

export async function hydrateBlogs(
  db: DatabaseProvider,
  blogs: BlogRecord[],
): Promise<BlogDto[]> {
  if (blogs.length === 0) return [];

  const blogIds = blogs.map((b) => b.id);
  const categoryIds = Array.from(new Set(blogs.map((b) => b.category_id).filter(Boolean)));
  const authorIds = Array.from(
    new Set(blogs.map((b) => b.author_id).filter((id): id is number => id !== null && id !== undefined)),
  );

  const categoryMap = new Map<number, { id: number; name: string }>();
  if (categoryIds.length > 0) {
    const placeholders = categoryIds.map(() => "?").join(",");
    const catRows = await db.query<{ id: number; name: string }>(
      `SELECT id, name FROM blog_categories WHERE id IN (${placeholders})`,
      categoryIds,
    );
    for (const c of catRows) {
      categoryMap.set(c.id, c);
    }
  }

  const authorMap = new Map<number, { id: number; name: string; email: string | null }>();
  if (authorIds.length > 0) {
    const placeholders = authorIds.map(() => "?").join(",");
    const authorRows = await db.query<{ id: number; name: string; email: string | null }>(
      `SELECT id, name, email FROM authors WHERE id IN (${placeholders})`,
      authorIds,
    );
    for (const a of authorRows) {
      authorMap.set(a.id, a);
    }
  }

  const blogTagsMap = new Map<number, Array<{ id: number; name: string }>>();
  if (blogIds.length > 0) {
    const placeholders = blogIds.map(() => "?").join(",");
    const tagRows = await db.query<{ blog_id: number; id: number; name: string }>(
      `SELECT bt.blog_id, t.id, t.name
       FROM blog_tags bt
       JOIN tags t ON bt.tag_id = t.id
       WHERE bt.blog_id IN (${placeholders})`,
      blogIds,
    );
    for (const t of tagRows) {
      const list = blogTagsMap.get(t.blog_id) ?? [];
      list.push({ id: t.id, name: t.name });
      blogTagsMap.set(t.blog_id, list);
    }
  }

  return blogs.map((row) => ({
    id: row.id,
    title: row.title,
    excerpt: row.excerpt ?? null,
    content: row.content,
    cover_image: row.cover_image ?? null,
    date: formatIsoDate(row.date),
    reading_time: row.reading_time !== null && row.reading_time !== undefined ? Number(row.reading_time) : null,
    featured: Boolean(row.featured),
    is_visible: Boolean(row.is_visible),
    quick_links: parseJsonField<Array<{ title: string; url: string }>>(row.quick_links) ?? [],
    category_id: row.category_id,
    category: categoryMap.get(row.category_id) ?? null,
    author_id: row.author_id ?? null,
    author: row.author_id ? authorMap.get(row.author_id) ?? null : null,
    tags: blogTagsMap.get(row.id) ?? [],
  }));
}

export async function listVisibleBlogs(db: DatabaseProvider): Promise<BlogDto[]> {
  const rows = await db.query<BlogRecord>(
    "SELECT * FROM blogs WHERE is_visible = 1 ORDER BY date DESC",
  );
  return hydrateBlogs(db, rows);
}

export async function getBlogById(
  db: DatabaseProvider,
  id: number,
): Promise<BlogDto | null> {
  const rows = await db.query<BlogRecord>(
    "SELECT * FROM blogs WHERE id = ?",
    [id],
  );
  if (!rows[0]) return null;
  const hydrated = await hydrateBlogs(db, [rows[0]]);
  return hydrated[0] ?? null;
}

export async function getRelatedBlogs(
  db: DatabaseProvider,
  blogId: number,
): Promise<BlogDto[]> {
  const blog = await getBlogById(db, blogId);
  if (!blog) return [];

  const tagIds = blog.tags.map((t) => t.id);
  let relatedRecords: BlogRecord[] = [];

  if (tagIds.length === 0) {
    relatedRecords = await db.query<BlogRecord>(
      "SELECT * FROM blogs WHERE id != ? ORDER BY date DESC LIMIT 5",
      [blogId],
    );
  } else {
    const placeholders = tagIds.map(() => "?").join(",");
    relatedRecords = await db.query<BlogRecord>(
      `SELECT DISTINCT b.*
       FROM blogs b
       JOIN blog_tags bt ON b.id = bt.blog_id
       WHERE b.id != ? AND bt.tag_id IN (${placeholders})
       ORDER BY b.date DESC
       LIMIT 5`,
      [blogId, ...tagIds],
    );

    if (relatedRecords.length < 5) {
      const excludedIds = [blogId, ...relatedRecords.map((b) => b.id)];
      const exPlaceholders = excludedIds.map(() => "?").join(",");
      const limitRemaining = 5 - relatedRecords.length;

      const extraRecords = await db.query<BlogRecord>(
        `SELECT * FROM blogs
         WHERE id NOT IN (${exPlaceholders})
         ORDER BY date DESC
         LIMIT ?`,
        [...excludedIds, limitRemaining],
      );
      relatedRecords = [...relatedRecords, ...extraRecords];
    }
  }

  return hydrateBlogs(db, relatedRecords);
}

export async function getPopularTags(
  db: DatabaseProvider,
): Promise<{
  popular_tags: Array<{
    id: number;
    name: string;
    count: number;
    percentage: number;
  }>;
  total_blogs: number;
}> {
  const countRow = await db.query<{ count: number }>(
    "SELECT COUNT(*) AS count FROM blogs WHERE is_visible = 1",
  );
  const totalBlogs = Number(countRow[0]?.count ?? 0);

  if (totalBlogs === 0) {
    return {
      popular_tags: [],
      total_blogs: 0,
    };
  }

  const rows = await db.query<{ id: number; name: string; count: number }>(
    `SELECT t.id, t.name, COUNT(bt.blog_id) AS count
     FROM tags t
     JOIN blog_tags bt ON t.id = bt.tag_id
     JOIN blogs b ON bt.blog_id = b.id
     WHERE b.is_visible = 1
     GROUP BY t.id, t.name
     ORDER BY COUNT(bt.blog_id) DESC
     LIMIT 10`,
  );

  return {
    popular_tags: rows.map((r) => {
      const count = Number(r.count);
      return {
        id: r.id,
        name: r.name,
        count,
        percentage: Number(((count / totalBlogs) * 100).toFixed(1)),
      };
    }),
    total_blogs: totalBlogs,
  };
}

export async function getPopularTagsSimple(
  db: DatabaseProvider,
): Promise<{
  popular_tags: Array<{
    id: number;
    name: string;
    count: number;
    percentage: number;
  }>;
  total_blogs: number;
}> {
  const result = await getPopularTags(db);
  return {
    popular_tags: result.popular_tags.map((t) => ({ ...t, id: 0 })),
    total_blogs: result.total_blogs,
  };
}

export async function listBlogsAdmin(
  db: DatabaseProvider,
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
  },
): Promise<{
  blogs: BlogDto[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  current_filter: string;
  counts: {
    all: number;
    visible: number;
    hidden: number;
  };
}> {
  const page = Math.max(1, options.page ?? 1);
  const pageSize = Math.max(1, options.pageSize ?? 5);
  const search = options.search?.trim() ?? "";
  const status = (options.status?.trim().toLowerCase() ?? "all");

  const [allCountRow, visibleCountRow, hiddenCountRow] = await Promise.all([
    db.query<{ count: number }>("SELECT COUNT(*) AS count FROM blogs"),
    db.query<{ count: number }>("SELECT COUNT(*) AS count FROM blogs WHERE is_visible = 1"),
    db.query<{ count: number }>("SELECT COUNT(*) AS count FROM blogs WHERE is_visible = 0"),
  ]);

  const counts = {
    all: Number(allCountRow[0]?.count ?? 0),
    visible: Number(visibleCountRow[0]?.count ?? 0),
    hidden: Number(hiddenCountRow[0]?.count ?? 0),
  };

  const whereClauses: string[] = [];
  const params: SqlValue[] = [];

  if (search) {
    whereClauses.push("(LOWER(title) LIKE ? OR LOWER(content) LIKE ? OR LOWER(excerpt) LIKE ?)");
    const pattern = `%${search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  if (status === "visible") {
    whereClauses.push("is_visible = 1");
  } else if (status === "hidden") {
    whereClauses.push("is_visible = 0");
  }

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";

  const totalRow = await db.query<{ count: number }>(
    `SELECT COUNT(*) AS count FROM blogs ${whereSql}`,
    params,
  );
  const total = Number(totalRow[0]?.count ?? 0);
  const totalPages = Math.ceil(total / pageSize) || 0;

  const offset = (page - 1) * pageSize;
  const rows = await db.query<BlogRecord>(
    `SELECT * FROM blogs ${whereSql} ORDER BY date DESC LIMIT ? OFFSET ?`,
    [...params, pageSize, offset],
  );

  const hydrated = await hydrateBlogs(db, rows);

  return {
    blogs: hydrated,
    total,
    page,
    page_size: pageSize,
    total_pages: totalPages,
    current_filter: status,
    counts,
  };
}

export async function createBlog(
  db: DatabaseProvider,
  input: CreateBlogInput,
): Promise<BlogDto> {
  const category = await getBlogCategoryById(db, input.category_id);
  if (!category) {
    throw new Error("Category not found.");
  }

  const author = await findOrCreateAuthor(db, input.author);
  const tags = input.tags ? await findOrCreateTags(db, input.tags) : [];

  const isVisible =
    typeof input.is_visible === "string"
      ? input.is_visible.toLowerCase() === "true"
      : input.is_visible !== undefined
        ? Boolean(input.is_visible)
        : true;

  const featured =
    typeof input.featured === "string"
      ? input.featured.toLowerCase() === "true"
      : Boolean(input.featured);

  let dateValue: string | null = null;
  if (input.date) {
    dateValue = formatIsoDate(input.date);
  }

  const quickLinksJson = serializeJsonField(input.quick_links ?? []);

  const result = await db.execute(
    `INSERT INTO blogs (
      title, excerpt, content, cover_image, date, reading_time,
      featured, is_visible, quick_links, category_id, author_id
    ) VALUES (?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP), ?, ?, ?, ?, ?, ?)`,
    [
      input.title.trim(),
      input.excerpt ? input.excerpt.trim() : "",
      input.content,
      input.cover_image ? input.cover_image.trim() : "",
      dateValue,
      input.reading_time ?? null,
      featured ? 1 : 0,
      isVisible ? 1 : 0,
      quickLinksJson,
      input.category_id,
      author.id,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (await db.query<{ id: number }>(
      "SELECT id FROM blogs WHERE title = ? ORDER BY id DESC LIMIT 1",
      [input.title.trim()],
    ))[0]?.id;

  if (tags.length > 0) {
    await syncBlogTags(db, insertId, tags);
  }

  const created = await getBlogById(db, insertId);
  if (!created) {
    throw new Error("Failed to retrieve created blog");
  }
  return created;
}

export async function updateBlog(
  db: DatabaseProvider,
  id: number,
  input: UpdateBlogInput,
): Promise<BlogDto> {
  const existing = await getBlogById(db, id);
  if (!existing) {
    throw new Error("Blog not found");
  }

  let authorId = existing.author_id;
  if (input.author) {
    const author = await findOrCreateAuthor(db, input.author);
    authorId = author.id;
  }

  let categoryId = existing.category_id;
  if (input.category_id !== undefined) {
    const category = await getBlogCategoryById(db, input.category_id);
    if (!category) {
      throw new Error("Category not found.");
    }
    categoryId = category.id;
  }

  let isVisible = existing.is_visible;
  if (input.is_visible !== undefined) {
    isVisible =
      typeof input.is_visible === "string"
        ? input.is_visible.toLowerCase() === "true"
        : Boolean(input.is_visible);
  }

  let featured = existing.featured;
  if (input.featured !== undefined) {
    featured =
      typeof input.featured === "string"
        ? input.featured.toLowerCase() === "true"
        : Boolean(input.featured);
  }

  let dateValue = existing.date;
  if (input.date !== undefined) {
    dateValue = input.date ? formatIsoDate(input.date) : null;
  }

  let quickLinks = existing.quick_links;
  if (input.quick_links !== undefined) {
    quickLinks = input.quick_links;
  }
  const quickLinksJson = serializeJsonField(quickLinks ?? []);

  await db.execute(
    `UPDATE blogs SET
      title = ?,
      excerpt = ?,
      content = ?,
      cover_image = ?,
      date = COALESCE(?, CURRENT_TIMESTAMP),
      reading_time = ?,
      featured = ?,
      is_visible = ?,
      quick_links = ?,
      category_id = ?,
      author_id = ?
     WHERE id = ?`,
    [
      input.title !== undefined ? input.title.trim() : existing.title,
      input.excerpt !== undefined ? (input.excerpt ? input.excerpt.trim() : "") : existing.excerpt,
      input.content !== undefined ? input.content : existing.content,
      input.cover_image !== undefined ? (input.cover_image ? input.cover_image.trim() : "") : existing.cover_image,
      dateValue,
      input.reading_time !== undefined ? input.reading_time : existing.reading_time,
      featured ? 1 : 0,
      isVisible ? 1 : 0,
      quickLinksJson,
      categoryId,
      authorId,
      id,
    ],
  );

  if (input.tags !== undefined) {
    const tags = await findOrCreateTags(db, input.tags);
    await syncBlogTags(db, id, tags);
  }

  const updated = await getBlogById(db, id);
  if (!updated) {
    throw new Error("Failed to retrieve updated blog");
  }
  return updated;
}

export async function deleteBlog(
  db: DatabaseProvider,
  id: number,
): Promise<void> {
  await db.execute("DELETE FROM comments WHERE blog_id = ?", [id]);
  await db.execute("DELETE FROM blog_tags WHERE blog_id = ?", [id]);
  await db.execute("DELETE FROM blogs WHERE id = ?", [id]);
}
