import { formatIsoDate } from "@/lib/auth/user-repository";
import type { DatabaseProvider } from "@/lib/database/types";

export interface ProjectRecord extends Record<string, unknown> {
  id: number;
  title: string;
  description: string;
  tech: string | string[] | null;
  links: string | Array<{ name: string; url: string }> | null;
  image: string | null;
  gallery: string | string[] | null;
  project_type: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  role: string | null;
  team_size: number | null;
  categories: string | string[] | null;
  is_visible: boolean | number;
  is_featured: boolean | number;
  order: number;
  created_at: string | Date | null;
}

export interface ProjectDto {
  id: number;
  title: string;
  description: string;
  tech: string[] | null;
  links: Array<{ name: string; url: string }> | null;
  image: string | null;
  gallery: string[] | null;
  project_type: string | null;
  start_date: string | null;
  end_date: string | null;
  role: string | null;
  team_size: number | null;
  categories: string[] | null;
  is_visible: boolean;
  is_featured: boolean;
  order: number;
  created_at: string | null;
}

export interface ProjectInputParams {
  title: string;
  description: string;
  tech?: string[] | null;
  links?: Array<{ name: string; url: string }> | null;
  image?: string | null;
  gallery?: string[] | null;
  project_type?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  role?: string | null;
  team_size?: number | null;
  categories?: string[] | null;
  is_visible?: boolean;
  is_featured?: boolean;
  order?: number;
}

export function parseJsonField<T>(field: unknown): T | null {
  if (field === null || field === undefined) {
    return null;
  }
  if (typeof field === "string") {
    try {
      return JSON.parse(field) as T;
    } catch {
      return null;
    }
  }
  return field as T;
}

export function serializeJsonField(field: unknown): string | null {
  if (field === null || field === undefined) {
    return null;
  }
  if (typeof field === "string") {
    return field;
  }
  return JSON.stringify(field);
}

export function formatDateOnly(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function normalizeDateInput(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
      return trimmed.slice(0, 10);
    }
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) {
      return d.toISOString().slice(0, 10);
    }
  }
  return null;
}

export function parseCategoriesInput(input: unknown): string[] {
  if (!Array.isArray(input)) {
    if (typeof input === "string") {
      return input.split(",").map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }
  const result: string[] = [];
  for (const item of input) {
    if (typeof item === "object" && item !== null) {
      const rec = item as Record<string, unknown>;
      const val = rec.name ?? rec.id;
      if (val !== undefined && val !== null) {
        result.push(String(val).trim());
      }
    } else if (typeof item === "string" || typeof item === "number") {
      result.push(String(item).trim());
    }
  }
  return result;
}

export function parseLinksInput(input: unknown): Array<{ name: string; url: string }> {
  if (!Array.isArray(input)) return [];
  const result: Array<{ name: string; url: string }> = [];
  for (const item of input) {
    if (typeof item === "object" && item !== null) {
      const rec = item as Record<string, unknown>;
      result.push({
        name: typeof rec.name === "string" ? rec.name.trim() : String(rec.name ?? ""),
        url: typeof rec.url === "string" ? rec.url.trim() : String(rec.url ?? ""),
      });
    } else if (item !== undefined && item !== null) {
      result.push({
        name: String(item).trim(),
        url: "",
      });
    }
  }
  return result;
}

export function formatProjectDto(row: ProjectRecord): ProjectDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    tech: parseJsonField<string[]>(row.tech) ?? [],
    links: parseJsonField<Array<{ name: string; url: string }>>(row.links) ?? [],
    image: row.image ?? null,
    gallery: parseJsonField<string[]>(row.gallery) ?? [],
    project_type: row.project_type ?? null,
    start_date: formatDateOnly(row.start_date),
    end_date: formatDateOnly(row.end_date),
    role: row.role ?? null,
    team_size:
      row.team_size !== null && row.team_size !== undefined
        ? Number(row.team_size)
        : null,
    categories: parseJsonField<string[]>(row.categories) ?? [],
    is_visible: Boolean(row.is_visible),
    is_featured: Boolean(row.is_featured),
    order: Number(row.order ?? 0),
    created_at: formatIsoDate(row.created_at),
  };
}

export async function getVisibleProjects(
  db: DatabaseProvider,
): Promise<ProjectRecord[]> {
  return db.query<ProjectRecord>(
    'SELECT * FROM projects WHERE is_visible = 1 ORDER BY "order" ASC',
  );
}

export async function getFeaturedProjects(
  db: DatabaseProvider,
): Promise<ProjectRecord[]> {
  return db.query<ProjectRecord>(
    'SELECT * FROM projects WHERE is_visible = 1 AND is_featured = 1 ORDER BY "order" ASC',
  );
}

export async function getAllProjects(
  db: DatabaseProvider,
): Promise<ProjectRecord[]> {
  return db.query<ProjectRecord>(
    'SELECT * FROM projects ORDER BY "order" ASC',
  );
}

export async function getProjectById(
  db: DatabaseProvider,
  id: number,
): Promise<ProjectRecord | null> {
  const rows = await db.query<ProjectRecord>(
    "SELECT * FROM projects WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createProject(
  db: DatabaseProvider,
  params: ProjectInputParams,
): Promise<ProjectRecord> {
  const techJson = serializeJsonField(params.tech ?? []);
  const linksJson = serializeJsonField(params.links ?? []);
  const galleryJson = serializeJsonField(params.gallery ?? []);
  const categoriesJson = serializeJsonField(params.categories ?? []);

  const result = await db.execute(
    `INSERT INTO projects (
      title, description, tech, links, image, gallery, project_type,
      start_date, end_date, role, team_size, categories,
      is_visible, is_featured, "order", created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      params.title,
      params.description,
      techJson,
      linksJson,
      params.image ?? "",
      galleryJson,
      params.project_type ?? "",
      params.start_date ?? null,
      params.end_date ?? null,
      params.role ?? "",
      params.team_size ?? null,
      categoriesJson,
      params.is_visible !== false ? 1 : 0,
      params.is_featured ? 1 : 0,
      params.order ?? 0,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (result.rows[0] ? Number(result.rows[0].id) : null);

  if (insertId) {
    const created = await getProjectById(db, insertId);
    if (created) return created;
  }

  // Fallback lookup by title and description
  const rows = await db.query<ProjectRecord>(
    "SELECT * FROM projects WHERE title = ? AND description = ? ORDER BY id DESC LIMIT 1",
    [params.title, params.description],
  );
  if (!rows[0]) {
    throw new Error("Failed to retrieve created project.");
  }
  return rows[0];
}

export async function updateProject(
  db: DatabaseProvider,
  id: number,
  params: Partial<ProjectInputParams>,
): Promise<ProjectRecord | null> {
  const current = await getProjectById(db, id);
  if (!current) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.title !== undefined) {
    updates.push("title = ?");
    values.push(params.title);
  }
  if (params.description !== undefined) {
    updates.push("description = ?");
    values.push(params.description);
  }
  if (params.tech !== undefined) {
    updates.push("tech = ?");
    values.push(serializeJsonField(params.tech));
  }
  if (params.links !== undefined) {
    updates.push("links = ?");
    values.push(serializeJsonField(params.links));
  }
  if (params.image !== undefined) {
    updates.push("image = ?");
    values.push(params.image);
  }
  if (params.gallery !== undefined) {
    updates.push("gallery = ?");
    values.push(serializeJsonField(params.gallery));
  }
  if (params.project_type !== undefined) {
    updates.push("project_type = ?");
    values.push(params.project_type);
  }
  if (params.start_date !== undefined) {
    updates.push("start_date = ?");
    values.push(params.start_date);
  }
  if (params.end_date !== undefined) {
    updates.push("end_date = ?");
    values.push(params.end_date);
  }
  if (params.role !== undefined) {
    updates.push("role = ?");
    values.push(params.role);
  }
  if (params.team_size !== undefined) {
    updates.push("team_size = ?");
    values.push(params.team_size);
  }
  if (params.categories !== undefined) {
    updates.push("categories = ?");
    values.push(serializeJsonField(params.categories));
  }
  if (params.is_visible !== undefined) {
    updates.push("is_visible = ?");
    values.push(params.is_visible ? 1 : 0);
  }
  if (params.is_featured !== undefined) {
    updates.push("is_featured = ?");
    values.push(params.is_featured ? 1 : 0);
  }
  if (params.order !== undefined) {
    updates.push('"order" = ?');
    values.push(params.order);
  }

  if (updates.length === 0) {
    return current;
  }

  values.push(id);
  await db.execute(
    `UPDATE projects SET ${updates.join(", ")} WHERE id = ?`,
    values as any[],
  );

  return getProjectById(db, id);
}

export async function deleteProject(
  db: DatabaseProvider,
  id: number,
): Promise<boolean> {
  const result = await db.execute("DELETE FROM projects WHERE id = ?", [id]);
  return result.changes > 0;
}
