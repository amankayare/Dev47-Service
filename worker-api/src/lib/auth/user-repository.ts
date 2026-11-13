import type { DatabaseProvider } from "../database/types";

export interface UserRecord extends Record<string, unknown> {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  is_admin: boolean | number;
  created_at: string | Date | null;
  last_login: string | Date | null;
  reset_password_token: string | null;
  reset_password_expires: string | Date | null;
}

export interface UserDto {
  id: number;
  username: string;
  email: string;
  is_admin: boolean;
  created_at: string | null;
  last_login: string | null;
}

export function formatIsoDate(value: unknown): string | null {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "string") {
    if (value.includes("T")) {
      return value;
    }
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(value)) {
      return value.replace(" ", "T");
    }
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
    return value;
  }
  if (typeof value === "number") {
    return new Date(value).toISOString();
  }
  return null;
}

export function formatUserDto(user: UserRecord): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    is_admin: Boolean(user.is_admin),
    created_at: formatIsoDate(user.created_at),
    last_login: formatIsoDate(user.last_login),
  };
}

export async function findUserById(
  db: DatabaseProvider,
  id: number,
): Promise<UserRecord | null> {
  const rows = await db.query<UserRecord>(
    "SELECT id, username, email, password_hash, is_admin, created_at, last_login, reset_password_token, reset_password_expires FROM users WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function findUserByUsername(
  db: DatabaseProvider,
  username: string,
): Promise<UserRecord | null> {
  const rows = await db.query<UserRecord>(
    "SELECT id, username, email, password_hash, is_admin, created_at, last_login, reset_password_token, reset_password_expires FROM users WHERE username = ? LIMIT 1",
    [username],
  );
  return rows[0] ?? null;
}

export async function findUserByEmail(
  db: DatabaseProvider,
  email: string,
): Promise<UserRecord | null> {
  const rows = await db.query<UserRecord>(
    "SELECT id, username, email, password_hash, is_admin, created_at, last_login, reset_password_token, reset_password_expires FROM users WHERE email = ? LIMIT 1",
    [email],
  );
  return rows[0] ?? null;
}

export async function findUserByUsernameOrEmail(
  db: DatabaseProvider,
  identifier: string,
): Promise<UserRecord | null> {
  const rows = await db.query<UserRecord>(
    "SELECT id, username, email, password_hash, is_admin, created_at, last_login, reset_password_token, reset_password_expires FROM users WHERE username = ? OR email = ? LIMIT 1",
    [identifier, identifier],
  );
  return rows[0] ?? null;
}

export async function findUserByResetToken(
  db: DatabaseProvider,
  token: string,
): Promise<UserRecord | null> {
  const rows = await db.query<UserRecord>(
    "SELECT id, username, email, password_hash, is_admin, created_at, last_login, reset_password_token, reset_password_expires FROM users WHERE reset_password_token = ? LIMIT 1",
    [token],
  );
  return rows[0] ?? null;
}

export async function createUser(
  db: DatabaseProvider,
  params: {
    username: string;
    email: string;
    passwordHash: string;
    isAdmin?: boolean;
  },
): Promise<UserRecord> {
  await db.execute(
    "INSERT INTO users (username, email, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)",
    [
      params.username,
      params.email,
      params.passwordHash,
      params.isAdmin ? 1 : 0,
    ],
  );

  const user = await findUserByUsername(db, params.username);
  if (!user) {
    throw new Error("User creation failed to return created user record.");
  }
  return user;
}

export async function updateUserLastLogin(
  db: DatabaseProvider,
  id: number,
): Promise<void> {
  await db.execute(
    "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
    [id],
  );
}

export async function updateUserPassword(
  db: DatabaseProvider,
  id: number,
  passwordHash: string,
): Promise<void> {
  await db.execute(
    "UPDATE users SET password_hash = ?, last_login = CURRENT_TIMESTAMP WHERE id = ?",
    [passwordHash, id],
  );
}

export async function updateUserProfile(
  db: DatabaseProvider,
  id: number,
  username: string,
  email: string,
): Promise<UserRecord> {
  await db.execute(
    "UPDATE users SET username = ?, email = ? WHERE id = ?",
    [username, email, id],
  );

  const updated = await findUserById(db, id);
  if (!updated) {
    throw new Error("User not found after update.");
  }
  return updated;
}

export async function setUserResetToken(
  db: DatabaseProvider,
  id: number,
  token: string,
  expiresAt: Date,
): Promise<void> {
  await db.execute(
    "UPDATE users SET reset_password_token = ?, reset_password_expires = ? WHERE id = ?",
    [token, expiresAt.toISOString(), id],
  );
}

export async function clearUserResetTokenAndUpdatePassword(
  db: DatabaseProvider,
  id: number,
  newPasswordHash: string,
): Promise<void> {
  await db.execute(
    "UPDATE users SET password_hash = ?, reset_password_token = NULL, reset_password_expires = NULL WHERE id = ?",
    [newPasswordHash, id],
  );
}
