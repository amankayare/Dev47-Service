import { findUserById, type UserRecord } from "@/lib/auth/user-repository";
import type { DatabaseProvider } from "@/lib/database/types";

export interface AdminDashboardStats {
  projects_count: number;
  blogs_count: number;
  certifications_count: number;
  contact_messages_count: number;
  unseen_messages_count: number;
  users_count: number;
}

export async function getAdminDashboardStats(
  db: DatabaseProvider,
): Promise<AdminDashboardStats> {
  const [
    projectsCount,
    blogsCount,
    certsCount,
    messagesCount,
    unseenCount,
    usersCount,
  ] = await Promise.all([
    db.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM projects"),
    db.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM blogs"),
    db.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM certifications"),
    db.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM contact_messages"),
    db.query<{ count: number | string }>(
      "SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0",
    ),
    db.query<{ count: number | string }>("SELECT COUNT(*) AS count FROM users"),
  ]);

  return {
    projects_count: Number(projectsCount[0]?.count ?? 0),
    blogs_count: Number(blogsCount[0]?.count ?? 0),
    certifications_count: Number(certsCount[0]?.count ?? 0),
    contact_messages_count: Number(messagesCount[0]?.count ?? 0),
    unseen_messages_count: Number(unseenCount[0]?.count ?? 0),
    users_count: Number(usersCount[0]?.count ?? 0),
  };
}

export interface PaginatedUsersResult {
  users: UserRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export async function getPaginatedUsers(
  db: DatabaseProvider,
  page = 1,
  pageSize = 10,
  search = "",
): Promise<PaginatedUsersResult> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.max(1, pageSize);
  const trimmedSearch = search.trim();

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (trimmedSearch) {
    conditions.push("(LOWER(username) LIKE ? OR LOWER(email) LIKE ?)");
    const pattern = `%${trimmedSearch.toLowerCase()}%`;
    params.push(pattern, pattern);
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const countRows = await db.query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM users ${whereClause}`,
    params as any[],
  );
  const total = Number(countRows[0]?.count ?? 0);

  const offset = (safePage - 1) * safePageSize;
  const listParams = [...params, safePageSize, offset];
  const users = await db.query<UserRecord>(
    `SELECT * FROM users ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    listParams as any[],
  );

  const totalPages = Math.ceil(total / safePageSize);

  return {
    users,
    total,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
  };
}

export async function toggleUserAdmin(
  db: DatabaseProvider,
  userId: number,
): Promise<UserRecord | null> {
  const user = await findUserById(db, userId);
  if (!user) {
    return null;
  }

  const newIsAdmin = !Boolean(user.is_admin);
  await db.execute("UPDATE users SET is_admin = ? WHERE id = ?", [
    newIsAdmin ? 1 : 0,
    userId,
  ]);

  return findUserById(db, userId);
}
