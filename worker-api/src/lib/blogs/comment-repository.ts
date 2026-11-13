import { formatIsoDate } from "@/lib/auth/user-repository";
import type { DatabaseProvider } from "@/lib/database/types";

export interface CommentRecord extends Record<string, unknown> {
  id: number;
  content: string;
  created_at: string | Date | null;
  updated_at: string | Date | null;
  author_id: number;
  blog_id: number;
  parent_id: number | null;
  author_username?: string;
  author_is_admin?: boolean | number;
}

export interface CommentAuthorDto {
  id: number;
  username: string;
  is_admin: boolean;
}

export interface CommentDto {
  id: number;
  content: string;
  created_at: string;
  updated_at: string;
  parent_id: number | null;
  author: CommentAuthorDto;
  replies?: CommentDto[];
}

export async function getCommentsByBlogId(
  db: DatabaseProvider,
  blogId: number,
): Promise<CommentDto[]> {
  const rows = await db.query<CommentRecord>(
    `SELECT c.id, c.content, c.created_at, c.updated_at, c.parent_id, c.author_id,
            u.username AS author_username, u.is_admin AS author_is_admin
     FROM comments c
     JOIN users u ON c.author_id = u.id
     WHERE c.blog_id = ?
     ORDER BY c.created_at ASC`,
    [blogId],
  );

  const commentsDict = new Map<number, CommentDto>();
  const topLevelComments: CommentDto[] = [];

  for (const row of rows) {
    const commentData: CommentDto = {
      id: row.id,
      content: row.content,
      created_at: formatIsoDate(row.created_at) ?? new Date().toISOString(),
      updated_at: formatIsoDate(row.updated_at) ?? new Date().toISOString(),
      parent_id: row.parent_id ?? null,
      author: {
        id: row.author_id,
        username: row.author_username ?? "Anonymous",
        is_admin: Boolean(row.author_is_admin),
      },
      replies: [],
    };
    commentsDict.set(row.id, commentData);

    if (row.parent_id === null || row.parent_id === undefined) {
      topLevelComments.push(commentData);
    }
  }

  for (const row of rows) {
    if (row.parent_id !== null && row.parent_id !== undefined) {
      const parent = commentsDict.get(row.parent_id);
      const child = commentsDict.get(row.id);
      if (parent && child) {
        parent.replies?.push(child);
      }
    }
  }

  topLevelComments.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return topLevelComments;
}

export async function getCommentById(
  db: DatabaseProvider,
  id: number,
): Promise<CommentRecord | null> {
  const rows = await db.query<CommentRecord>(
    "SELECT * FROM comments WHERE id = ?",
    [id],
  );
  return rows[0] ?? null;
}

export async function createComment(
  db: DatabaseProvider,
  params: {
    blogId: number;
    authorId: number;
    content: string;
    parentId?: number | null;
  },
): Promise<CommentDto> {
  const result = await db.execute(
    `INSERT INTO comments (
      content, author_id, blog_id, parent_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      params.content,
      params.authorId,
      params.blogId,
      params.parentId ?? null,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (await db.query<{ id: number }>(
      "SELECT id FROM comments WHERE author_id = ? AND blog_id = ? ORDER BY id DESC LIMIT 1",
      [params.authorId, params.blogId],
    ))[0]?.id;

  const rows = await db.query<CommentRecord>(
    `SELECT c.id, c.content, c.created_at, c.updated_at, c.parent_id, c.author_id,
            u.username AS author_username, u.is_admin AS author_is_admin
     FROM comments c
     JOIN users u ON c.author_id = u.id
     WHERE c.id = ?`,
    [insertId],
  );

  const row = rows[0];
  if (!row) {
    throw new Error("Failed to retrieve created comment");
  }

  return {
    id: row.id,
    content: row.content,
    created_at: formatIsoDate(row.created_at) ?? new Date().toISOString(),
    updated_at: formatIsoDate(row.updated_at) ?? new Date().toISOString(),
    parent_id: row.parent_id ?? null,
    author: {
      id: row.author_id,
      username: row.author_username ?? "",
      is_admin: Boolean(row.author_is_admin),
    },
  };
}

export async function updateComment(
  db: DatabaseProvider,
  id: number,
  content: string,
): Promise<void> {
  await db.execute(
    "UPDATE comments SET content = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [content, id],
  );
}

export async function deleteCommentTree(
  db: DatabaseProvider,
  commentId: number,
): Promise<void> {
  const idsToDelete: number[] = [commentId];
  let currentParents: number[] = [commentId];

  while (currentParents.length > 0) {
    const placeholders = currentParents.map(() => "?").join(",");
    const children = await db.query<{ id: number }>(
      `SELECT id FROM comments WHERE parent_id IN (${placeholders})`,
      currentParents,
    );
    const childIds = children.map((c) => c.id);
    if (childIds.length === 0) break;
    idsToDelete.push(...childIds);
    currentParents = childIds;
  }

  for (let i = idsToDelete.length - 1; i >= 0; i--) {
    await db.execute("DELETE FROM comments WHERE id = ?", [idsToDelete[i]]);
  }
}
