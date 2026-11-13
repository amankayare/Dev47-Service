import { formatIsoDate } from "@/lib/auth/user-repository";
import type { DatabaseProvider } from "@/lib/database/types";

export interface ContactMessageRecord extends Record<string, unknown> {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  phone: string | null;
  preferred_contact_method: string | null;
  is_read: boolean | number;
  read_at: string | Date | null;
  created_at: string | Date | null;
}

export interface ContactMessageDto {
  id: number;
  name: string;
  email: string;
  subject: string;
  message: string;
  phone: string | null;
  preferred_contact_method: string | null;
  is_read: boolean;
  read_at: string | null;
  created_at: string | null;
}

export interface CreateContactMessageParams {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string | null;
  preferred_contact_method?: string | null;
}

export function formatContactMessageDto(
  row: ContactMessageRecord,
): ContactMessageDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    subject: row.subject,
    message: row.message,
    phone: row.phone ?? null,
    preferred_contact_method: row.preferred_contact_method ?? null,
    is_read: Boolean(row.is_read),
    read_at: formatIsoDate(row.read_at),
    created_at: formatIsoDate(row.created_at),
  };
}

export async function createContactMessage(
  db: DatabaseProvider,
  params: CreateContactMessageParams,
): Promise<ContactMessageRecord> {
  const result = await db.execute(
    `INSERT INTO contact_messages (
      name, email, subject, message, phone, preferred_contact_method, is_read, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, 0, CURRENT_TIMESTAMP)`,
    [
      params.name,
      params.email,
      params.subject,
      params.message,
      params.phone ?? null,
      params.preferred_contact_method ?? null,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (result.rows[0] ? Number(result.rows[0].id) : null);

  if (insertId) {
    const created = await getContactMessageById(db, insertId);
    if (created) return created;
  }

  const rows = await db.query<ContactMessageRecord>(
    "SELECT * FROM contact_messages WHERE email = ? AND subject = ? ORDER BY id DESC LIMIT 1",
    [params.email, params.subject],
  );
  if (!rows[0]) {
    throw new Error("Failed to retrieve created contact message.");
  }
  return rows[0];
}

export async function getContactMessageById(
  db: DatabaseProvider,
  id: number,
): Promise<ContactMessageRecord | null> {
  const rows = await db.query<ContactMessageRecord>(
    "SELECT * FROM contact_messages WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export interface ContactMessagesFilter {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: "all" | "read" | "unread";
}

export interface PaginatedContactMessages {
  messages: ContactMessageRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  currentFilter: string;
  counts: {
    all: number;
    read: number;
    unread: number;
  };
}

export async function getPaginatedContactMessages(
  db: DatabaseProvider,
  filter: ContactMessagesFilter,
): Promise<PaginatedContactMessages> {
  const page = Math.max(1, filter.page ?? 1);
  const pageSize = Math.max(1, filter.pageSize ?? 10);
  const search = filter.search?.trim();
  const status = filter.status ?? "all";

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (search) {
    conditions.push(
      "(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(subject) LIKE ?)",
    );
    const pattern = `%${search.toLowerCase()}%`;
    params.push(pattern, pattern, pattern);
  }

  if (status === "read") {
    conditions.push("is_read = 1");
  } else if (status === "unread") {
    conditions.push("is_read = 0");
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Get total matching
  const countRows = await db.query<{ count: number | string }>(
    `SELECT COUNT(*) AS count FROM contact_messages ${whereClause}`,
    params as any[],
  );
  const total = Number(countRows[0]?.count ?? 0);

  // Get paginated items
  const offset = (page - 1) * pageSize;
  const listParams = [...params, pageSize, offset];
  const messages = await db.query<ContactMessageRecord>(
    `SELECT * FROM contact_messages ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    listParams as any[],
  );

  // Counts for filter badges
  const allCountRows = await db.query<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM contact_messages",
  );
  const readCountRows = await db.query<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 1",
  );
  const unreadCountRows = await db.query<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0",
  );

  const totalPages = Math.ceil(total / pageSize);

  return {
    messages,
    total,
    page,
    pageSize,
    totalPages,
    currentFilter: status,
    counts: {
      all: Number(allCountRows[0]?.count ?? 0),
      read: Number(readCountRows[0]?.count ?? 0),
      unread: Number(unreadCountRows[0]?.count ?? 0),
    },
  };
}

export async function toggleContactMessageRead(
  db: DatabaseProvider,
  id: number,
): Promise<{ message: ContactMessageRecord; statusMessage: string } | null> {
  const current = await getContactMessageById(db, id);
  if (!current) {
    return null;
  }

  const nextIsRead = !Boolean(current.is_read);
  const nextReadAt = nextIsRead ? new Date().toISOString() : null;

  await db.execute(
    "UPDATE contact_messages SET is_read = ?, read_at = ? WHERE id = ?",
    [nextIsRead ? 1 : 0, nextReadAt, id],
  );

  const updated = await getContactMessageById(db, id);
  if (!updated) return null;

  const statusMessage = nextIsRead
    ? "Contact message marked as read successfully"
    : "Contact message marked as unread successfully";

  return { message: updated, statusMessage };
}

export async function markAllContactMessagesRead(
  db: DatabaseProvider,
): Promise<number> {
  const unreadCountRows = await db.query<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0",
  );
  const updatedCount = Number(unreadCountRows[0]?.count ?? 0);

  if (updatedCount > 0) {
    await db.execute(
      "UPDATE contact_messages SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE is_read = 0",
    );
  }

  return updatedCount;
}

export async function deleteContactMessage(
  db: DatabaseProvider,
  id: number,
): Promise<boolean> {
  const result = await db.execute("DELETE FROM contact_messages WHERE id = ?", [id]);
  return result.changes > 0;
}
