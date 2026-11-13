import type { DatabaseProvider } from "@/lib/database/types";
import {
  formatDateOnly,
  normalizeDateInput,
  parseJsonField,
  serializeJsonField,
} from "@/lib/projects/project-repository";

export interface ExperienceRecord extends Record<string, unknown> {
  id: number;
  title: string;
  company: string;
  location: string | null;
  start_date: string | Date | null;
  end_date: string | Date | null;
  is_current: boolean | number;
  duration: string | null;
  responsibilities: string | string[] | null;
  achievements: string | string[] | null;
  technologies: string | string[] | null;
  color: string | null;
  order: number;
  is_visible: boolean | number;
  created_at: string | Date | null;
}

export interface ExperienceDto {
  id: number;
  title: string;
  company: string;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  is_current: boolean;
  period: string;
  duration: string | null;
  responsibilities: string[] | null;
  achievements: string[] | null;
  color: string | null;
  order: number;
  is_visible: boolean;
}

export interface ExperienceInputParams {
  title: string;
  company: string;
  location?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  is_current?: boolean;
  duration?: string | null;
  responsibilities?: string[] | null;
  achievements?: string[] | null;
  technologies?: string[] | null;
  color?: string | null;
  order?: number;
  is_visible?: boolean;
}

function formatMonthYear(value: unknown): string {
  if (!value) return "";
  const d = new Date(value as string);
  if (Number.isNaN(d.getTime())) return "";
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const year = d.getUTCFullYear();
  return `${month}/${year}`;
}

export function formatExperienceDto(row: ExperienceRecord): ExperienceDto {
  const isCurrent = Boolean(row.is_current);
  const startMonthYear = formatMonthYear(row.start_date);
  const endMonthYear = isCurrent ? "Present" : formatMonthYear(row.end_date);
  const period = `${startMonthYear} - ${endMonthYear}`;

  return {
    id: row.id,
    title: row.title,
    company: row.company,
    location: row.location ?? null,
    start_date: formatDateOnly(row.start_date),
    end_date: formatDateOnly(row.end_date),
    is_current: isCurrent,
    period,
    duration: row.duration ?? null,
    responsibilities: parseJsonField<string[]>(row.responsibilities) ?? [],
    achievements: parseJsonField<string[]>(row.achievements) ?? [],
    color: row.color ?? null,
    order: Number(row.order ?? 0),
    is_visible: Boolean(row.is_visible),
  };
}

export async function getExperiences(
  db: DatabaseProvider,
  showAll = false,
): Promise<ExperienceRecord[]> {
  if (showAll) {
    return db.query<ExperienceRecord>(
      'SELECT * FROM experiences ORDER BY "order" DESC, start_date DESC',
    );
  }
  return db.query<ExperienceRecord>(
    'SELECT * FROM experiences WHERE is_visible = 1 ORDER BY "order" DESC, start_date DESC',
  );
}

export async function getExperienceById(
  db: DatabaseProvider,
  id: number,
): Promise<ExperienceRecord | null> {
  const rows = await db.query<ExperienceRecord>(
    "SELECT * FROM experiences WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createExperience(
  db: DatabaseProvider,
  params: ExperienceInputParams,
): Promise<ExperienceRecord> {
  if (params.is_current) {
    await db.execute("UPDATE experiences SET is_current = 0 WHERE is_current = 1");
  }

  const respJson = serializeJsonField(params.responsibilities ?? []);
  const achJson = serializeJsonField(params.achievements ?? []);
  const techJson = serializeJsonField(params.technologies ?? []);

  const result = await db.execute(
    `INSERT INTO experiences (
      title, company, location, start_date, end_date, is_current,
      duration, responsibilities, achievements, technologies, color,
      "order", is_visible, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      params.title,
      params.company,
      params.location ?? "",
      params.start_date ?? null,
      params.end_date ?? null,
      params.is_current ? 1 : 0,
      params.duration ?? "",
      respJson,
      achJson,
      techJson,
      params.color ?? "",
      params.order ?? 0,
      params.is_visible !== false ? 1 : 0,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (result.rows[0] ? Number(result.rows[0].id) : null);

  if (insertId) {
    const created = await getExperienceById(db, insertId);
    if (created) return created;
  }

  const rows = await db.query<ExperienceRecord>(
    "SELECT * FROM experiences WHERE title = ? AND company = ? ORDER BY id DESC LIMIT 1",
    [params.title, params.company],
  );
  if (!rows[0]) {
    throw new Error("Failed to retrieve created experience.");
  }
  return rows[0];
}

export async function updateExperience(
  db: DatabaseProvider,
  id: number,
  params: Partial<ExperienceInputParams>,
): Promise<ExperienceRecord | null> {
  const current = await getExperienceById(db, id);
  if (!current) {
    return null;
  }

  if (params.is_current) {
    await db.execute(
      "UPDATE experiences SET is_current = 0 WHERE id != ? AND is_current = 1",
      [id],
    );
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.title !== undefined) {
    updates.push("title = ?");
    values.push(params.title);
  }
  if (params.company !== undefined) {
    updates.push("company = ?");
    values.push(params.company);
  }
  if (params.location !== undefined) {
    updates.push("location = ?");
    values.push(params.location);
  }
  if (params.start_date !== undefined) {
    updates.push("start_date = ?");
    values.push(params.start_date);
  }
  if (params.end_date !== undefined) {
    updates.push("end_date = ?");
    values.push(params.end_date);
  }
  if (params.is_current !== undefined) {
    updates.push("is_current = ?");
    values.push(params.is_current ? 1 : 0);
  }
  if (params.duration !== undefined) {
    updates.push("duration = ?");
    values.push(params.duration);
  }
  if (params.responsibilities !== undefined) {
    updates.push("responsibilities = ?");
    values.push(serializeJsonField(params.responsibilities));
  }
  if (params.achievements !== undefined) {
    updates.push("achievements = ?");
    values.push(serializeJsonField(params.achievements));
  }
  if (params.technologies !== undefined) {
    updates.push("technologies = ?");
    values.push(serializeJsonField(params.technologies));
  }
  if (params.color !== undefined) {
    updates.push("color = ?");
    values.push(params.color);
  }
  if (params.order !== undefined) {
    updates.push('"order" = ?');
    values.push(params.order);
  }
  if (params.is_visible !== undefined) {
    updates.push("is_visible = ?");
    values.push(params.is_visible ? 1 : 0);
  }

  if (updates.length === 0) {
    return current;
  }

  values.push(id);
  await db.execute(
    `UPDATE experiences SET ${updates.join(", ")} WHERE id = ?`,
    values as any[],
  );

  return getExperienceById(db, id);
}

export async function deleteExperience(
  db: DatabaseProvider,
  id: number,
): Promise<boolean> {
  const result = await db.execute("DELETE FROM experiences WHERE id = ?", [id]);
  return result.changes > 0;
}
