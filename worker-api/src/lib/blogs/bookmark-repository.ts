import type { DatabaseProvider } from "@/lib/database/types";
import { hydrateBlogs, type BlogDto, type BlogRecord } from "./blog-repository";

export async function getUserBookmarks(
  db: DatabaseProvider,
  userId: number,
): Promise<BlogDto[]> {
  const rows = await db.query<BlogRecord>(
    `SELECT b.*
     FROM blogs b
     JOIN user_bookmarks ub ON b.id = ub.blog_id
     WHERE ub.user_id = ?
     ORDER BY ub.created_at DESC`,
    [userId],
  );
  return hydrateBlogs(db, rows);
}

export async function getUserBookmarkIds(
  db: DatabaseProvider,
  userId: number,
): Promise<number[]> {
  const rows = await db.query<{ blog_id: number }>(
    "SELECT blog_id FROM user_bookmarks WHERE user_id = ?",
    [userId],
  );
  return rows.map((r) => r.blog_id);
}

export async function addBookmark(
  db: DatabaseProvider,
  userId: number,
  blogId: number,
): Promise<boolean> {
  await db.execute(
    `INSERT OR IGNORE INTO user_bookmarks (user_id, blog_id, created_at)
     VALUES (?, ?, CURRENT_TIMESTAMP)`,
    [userId, blogId],
  );
  return true;
}

export async function removeBookmark(
  db: DatabaseProvider,
  userId: number,
  blogId: number,
): Promise<boolean> {
  await db.execute(
    "DELETE FROM user_bookmarks WHERE user_id = ? AND blog_id = ?",
    [userId, blogId],
  );
  return true;
}

export async function isBookmarked(
  db: DatabaseProvider,
  userId: number,
  blogId: number,
): Promise<boolean> {
  const rows = await db.query<{ id: number }>(
    "SELECT id FROM user_bookmarks WHERE user_id = ? AND blog_id = ? LIMIT 1",
    [userId, blogId],
  );
  return rows.length > 0;
}
