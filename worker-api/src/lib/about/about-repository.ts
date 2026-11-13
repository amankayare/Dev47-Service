import type { DatabaseProvider } from "@/lib/database/types";
import { parseJsonField, serializeJsonField } from "@/lib/projects/project-repository";

export interface AboutRecord extends Record<string, unknown> {
  id: number;
  name: string;
  headline: string | null;
  bio: string;
  photo: string | null;
  cover_image: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  social_links: string | Record<string, unknown> | null;
}

export interface AboutDto {
  id: number;
  name: string;
  headline: string | null;
  bio: string;
  photo: string | null;
  cover_image: string | null;
  location: string | null;
  email: string | null;
  phone: string | null;
  resume_url: string | null;
  social_links: Record<string, unknown> | null;
}

export interface AboutInputParams {
  name: string;
  headline?: string | null;
  bio: string;
  photo?: string | null;
  cover_image?: string | null;
  location?: string | null;
  email?: string | null;
  phone?: string | null;
  resume_url?: string | null;
  social_links?: Record<string, unknown> | string | null;
}

export function formatAboutDto(row: AboutRecord): AboutDto {
  return {
    id: row.id,
    name: row.name,
    headline: row.headline ?? null,
    bio: row.bio,
    photo: row.photo ?? null,
    cover_image: row.cover_image ?? null,
    location: row.location ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    resume_url: row.resume_url ?? null,
    social_links: parseJsonField<Record<string, unknown>>(row.social_links) ?? null,
  };
}

export async function getAbout(
  db: DatabaseProvider,
): Promise<AboutRecord | null> {
  const rows = await db.query<AboutRecord>(
    "SELECT * FROM about LIMIT 1",
  );
  return rows[0] ?? null;
}

export async function createAbout(
  db: DatabaseProvider,
  params: AboutInputParams,
): Promise<AboutRecord> {
  const socialJson = serializeJsonField(params.social_links ?? {});

  await db.execute(
    `INSERT INTO about (
      name, headline, bio, photo, cover_image, location, email, phone, resume_url, social_links
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.name,
      params.headline ?? "",
      params.bio,
      params.photo ?? "",
      params.cover_image ?? "",
      params.location ?? "",
      params.email ?? "",
      params.phone ?? "",
      params.resume_url ?? "",
      socialJson,
    ],
  );

  const created = await getAbout(db);
  if (!created) {
    throw new Error("Failed to retrieve created about record.");
  }
  return created;
}

export async function updateAbout(
  db: DatabaseProvider,
  params: Partial<AboutInputParams>,
): Promise<AboutRecord | null> {
  const current = await getAbout(db);
  if (!current) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.name !== undefined) {
    updates.push("name = ?");
    values.push(params.name);
  }
  if (params.headline !== undefined) {
    updates.push("headline = ?");
    values.push(params.headline);
  }
  if (params.bio !== undefined) {
    updates.push("bio = ?");
    values.push(params.bio);
  }
  if (params.photo !== undefined) {
    updates.push("photo = ?");
    values.push(params.photo);
  }
  if (params.cover_image !== undefined) {
    updates.push("cover_image = ?");
    values.push(params.cover_image);
  }
  if (params.location !== undefined) {
    updates.push("location = ?");
    values.push(params.location);
  }
  if (params.email !== undefined) {
    updates.push("email = ?");
    values.push(params.email);
  }
  if (params.phone !== undefined) {
    updates.push("phone = ?");
    values.push(params.phone);
  }
  if (params.resume_url !== undefined) {
    updates.push("resume_url = ?");
    values.push(params.resume_url);
  }
  if (params.social_links !== undefined) {
    updates.push("social_links = ?");
    values.push(serializeJsonField(params.social_links));
  }

  if (updates.length === 0) {
    return current;
  }

  values.push(current.id);
  await db.execute(
    `UPDATE about SET ${updates.join(", ")} WHERE id = ?`,
    values as any[],
  );

  return getAbout(db);
}

export async function deleteAbout(
  db: DatabaseProvider,
): Promise<boolean> {
  const current = await getAbout(db);
  if (!current) {
    return false;
  }
  const result = await db.execute("DELETE FROM about WHERE id = ?", [current.id]);
  return result.changes > 0;
}
