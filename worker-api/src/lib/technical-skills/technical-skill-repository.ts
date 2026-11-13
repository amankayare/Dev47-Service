import type { DatabaseProvider } from "@/lib/database/types";
import {
  parseJsonField,
  serializeJsonField,
} from "@/lib/projects/project-repository";

export interface TechnicalSkillRecord extends Record<string, unknown> {
  id: number;
  title: string;
  skills: string | string[] | null;
  color: string | null;
  icon: string | null;
  order: number;
  is_visible: boolean | number;
  created_at: string | Date | null;
}

export interface TechnicalSkillDto {
  id: number;
  title: string;
  skills: string[] | null;
  color: string | null;
  icon: string | null;
  order: number;
  is_visible: boolean;
}

export interface TechnicalSkillInputParams {
  title: string;
  skills?: string[] | null;
  color?: string | null;
  icon?: string | null;
  order?: number;
  is_visible?: boolean;
}

export function formatTechnicalSkillDto(
  row: TechnicalSkillRecord,
): TechnicalSkillDto {
  return {
    id: row.id,
    title: row.title,
    skills: parseJsonField<string[]>(row.skills) ?? [],
    color: row.color ?? null,
    icon: row.icon ?? null,
    order: Number(row.order ?? 0),
    is_visible: Boolean(row.is_visible),
  };
}

export async function getTechnicalSkills(
  db: DatabaseProvider,
  showAll = false,
): Promise<TechnicalSkillRecord[]> {
  if (showAll) {
    return db.query<TechnicalSkillRecord>(
      'SELECT * FROM technical_skills ORDER BY "order" ASC',
    );
  }
  return db.query<TechnicalSkillRecord>(
    'SELECT * FROM technical_skills WHERE is_visible = 1 ORDER BY "order" ASC',
  );
}

export async function getTechnicalSkillById(
  db: DatabaseProvider,
  id: number,
): Promise<TechnicalSkillRecord | null> {
  const rows = await db.query<TechnicalSkillRecord>(
    "SELECT * FROM technical_skills WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createTechnicalSkill(
  db: DatabaseProvider,
  params: TechnicalSkillInputParams,
): Promise<TechnicalSkillRecord> {
  const skillsJson = serializeJsonField(params.skills ?? []);

  const result = await db.execute(
    `INSERT INTO technical_skills (
      title, skills, color, icon, "order", is_visible, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [
      params.title,
      skillsJson,
      params.color ?? "",
      params.icon ?? "",
      params.order ?? 0,
      params.is_visible !== false ? 1 : 0,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (result.rows[0] ? Number(result.rows[0].id) : null);

  if (insertId) {
    const created = await getTechnicalSkillById(db, insertId);
    if (created) return created;
  }

  const rows = await db.query<TechnicalSkillRecord>(
    "SELECT * FROM technical_skills WHERE title = ? ORDER BY id DESC LIMIT 1",
    [params.title],
  );
  if (!rows[0]) {
    throw new Error("Failed to retrieve created technical skill.");
  }
  return rows[0];
}

export async function updateTechnicalSkill(
  db: DatabaseProvider,
  id: number,
  params: Partial<TechnicalSkillInputParams>,
): Promise<TechnicalSkillRecord | null> {
  const current = await getTechnicalSkillById(db, id);
  if (!current) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.title !== undefined) {
    updates.push("title = ?");
    values.push(params.title);
  }
  if (params.skills !== undefined) {
    updates.push("skills = ?");
    values.push(serializeJsonField(params.skills));
  }
  if (params.color !== undefined) {
    updates.push("color = ?");
    values.push(params.color);
  }
  if (params.icon !== undefined) {
    updates.push("icon = ?");
    values.push(params.icon);
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
    `UPDATE technical_skills SET ${updates.join(", ")} WHERE id = ?`,
    values as any[],
  );

  return getTechnicalSkillById(db, id);
}

export async function deleteTechnicalSkill(
  db: DatabaseProvider,
  id: number,
): Promise<boolean> {
  const result = await db.execute("DELETE FROM technical_skills WHERE id = ?", [id]);
  return result.changes > 0;
}
