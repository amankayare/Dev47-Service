import type { DatabaseProvider } from "@/lib/database/types";

export interface BlogCategoryRecord extends Record<string, unknown> {
  id: number;
  name: string;
}

export interface BlogCategoryDto {
  id: number;
  name: string;
}

export function formatBlogCategoryDto(row: BlogCategoryRecord): BlogCategoryDto {
  return {
    id: row.id,
    name: row.name,
  };
}

export async function listBlogCategories(
  db: DatabaseProvider,
): Promise<BlogCategoryDto[]> {
  const rows = await db.query<BlogCategoryRecord>(
    "SELECT id, name FROM blog_categories ORDER BY name ASC",
  );
  return rows.map(formatBlogCategoryDto);
}

export async function getBlogCategoryById(
  db: DatabaseProvider,
  id: number,
): Promise<BlogCategoryDto | null> {
  const rows = await db.query<BlogCategoryRecord>(
    "SELECT id, name FROM blog_categories WHERE id = ?",
    [id],
  );
  return rows[0] ? formatBlogCategoryDto(rows[0]) : null;
}

export async function getBlogCategoryByName(
  db: DatabaseProvider,
  name: string,
): Promise<BlogCategoryDto | null> {
  const rows = await db.query<BlogCategoryRecord>(
    "SELECT id, name FROM blog_categories WHERE name = ?",
    [name],
  );
  return rows[0] ? formatBlogCategoryDto(rows[0]) : null;
}

export async function createBlogCategory(
  db: DatabaseProvider,
  name: string,
): Promise<BlogCategoryDto> {
  const result = await db.execute(
    "INSERT INTO blog_categories (name) VALUES (?)",
    [name],
  );

  const insertId =
    result.lastInsertRowId ??
    (await db.query<{ id: number }>(
      "SELECT id FROM blog_categories WHERE name = ?",
      [name],
    ))[0]?.id;

  const category = await getBlogCategoryById(db, insertId);
  if (!category) {
    throw new Error("Failed to retrieve created blog category");
  }
  return category;
}

export async function updateBlogCategory(
  db: DatabaseProvider,
  id: number,
  name: string,
): Promise<BlogCategoryDto> {
  await db.execute(
    "UPDATE blog_categories SET name = ? WHERE id = ?",
    [name, id],
  );

  const category = await getBlogCategoryById(db, id);
  if (!category) {
    throw new Error("Failed to retrieve updated blog category");
  }
  return category;
}

export async function deleteBlogCategory(
  db: DatabaseProvider,
  id: number,
): Promise<void> {
  // Find or create 'General' category
  let generalCategory = await getBlogCategoryByName(db, "General");
  if (!generalCategory) {
    generalCategory = await createBlogCategory(db, "General");
  }

  // Reassign all blogs to 'General' category
  await db.execute(
    "UPDATE blogs SET category_id = ? WHERE category_id = ?",
    [generalCategory.id, id],
  );

  // Delete category
  await db.execute(
    "DELETE FROM blog_categories WHERE id = ?",
    [id],
  );
}
