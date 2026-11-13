import type { DatabaseProvider } from "@/lib/database/types";
import {
  formatDateOnly,
  normalizeDateInput,
  parseCategoriesInput,
  parseJsonField,
  serializeJsonField,
} from "@/lib/projects/project-repository";

export interface CertificationRecord extends Record<string, unknown> {
  id: number;
  name: string;
  issuer: string;
  date: string | null;
  credential_url: string | null;
  description: string | null;
  skills: string | string[] | null;
  certificate_id: string | null;
  expiration_date: string | Date | null;
  is_visible: boolean | number;
}

export interface CertificationDto {
  id: number;
  name: string;
  issuer: string;
  date: string | null;
  credential_url: string | null;
  description: string | null;
  skills: string[] | null;
  certificate_id: string | null;
  expiration_date: string | null;
  is_visible: boolean;
}

export interface CertificationInputParams {
  name: string;
  issuer: string;
  date?: string | null;
  credential_url?: string | null;
  description?: string | null;
  skills?: string[] | null;
  certificate_id?: string | null;
  expiration_date?: string | null;
  is_visible?: boolean;
}

export function formatCertificationDto(row: CertificationRecord): CertificationDto {
  return {
    id: row.id,
    name: row.name,
    issuer: row.issuer,
    date: row.date ?? null,
    credential_url: row.credential_url ?? null,
    description: row.description ?? null,
    skills: parseJsonField<string[]>(row.skills) ?? [],
    certificate_id: row.certificate_id ?? null,
    expiration_date: formatDateOnly(row.expiration_date),
    is_visible: Boolean(row.is_visible),
  };
}

export async function getAllCertifications(
  db: DatabaseProvider,
): Promise<CertificationRecord[]> {
  return db.query<CertificationRecord>(
    "SELECT * FROM certifications ORDER BY id ASC",
  );
}

export async function getCertificationById(
  db: DatabaseProvider,
  id: number,
): Promise<CertificationRecord | null> {
  const rows = await db.query<CertificationRecord>(
    "SELECT * FROM certifications WHERE id = ? LIMIT 1",
    [id],
  );
  return rows[0] ?? null;
}

export async function createCertification(
  db: DatabaseProvider,
  params: CertificationInputParams,
): Promise<CertificationRecord> {
  const skillsJson = serializeJsonField(params.skills ?? []);

  const result = await db.execute(
    `INSERT INTO certifications (
      name, issuer, date, credential_url, description, skills, certificate_id, expiration_date, is_visible
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      params.name,
      params.issuer,
      params.date ?? "",
      params.credential_url ?? "",
      params.description ?? "",
      skillsJson,
      params.certificate_id ?? "",
      params.expiration_date ?? null,
      params.is_visible !== false ? 1 : 0,
    ],
  );

  const insertId =
    result.lastInsertRowId ??
    (result.rows[0] ? Number(result.rows[0].id) : null);

  if (insertId) {
    const created = await getCertificationById(db, insertId);
    if (created) return created;
  }

  const rows = await db.query<CertificationRecord>(
    "SELECT * FROM certifications WHERE name = ? AND issuer = ? ORDER BY id DESC LIMIT 1",
    [params.name, params.issuer],
  );
  if (!rows[0]) {
    throw new Error("Failed to retrieve created certification.");
  }
  return rows[0];
}

export async function updateCertification(
  db: DatabaseProvider,
  id: number,
  params: Partial<CertificationInputParams>,
): Promise<CertificationRecord | null> {
  const current = await getCertificationById(db, id);
  if (!current) {
    return null;
  }

  const updates: string[] = [];
  const values: unknown[] = [];

  if (params.name !== undefined) {
    updates.push("name = ?");
    values.push(params.name);
  }
  if (params.issuer !== undefined) {
    updates.push("issuer = ?");
    values.push(params.issuer);
  }
  if (params.date !== undefined) {
    updates.push("date = ?");
    values.push(params.date);
  }
  if (params.credential_url !== undefined) {
    updates.push("credential_url = ?");
    values.push(params.credential_url);
  }
  if (params.description !== undefined) {
    updates.push("description = ?");
    values.push(params.description);
  }
  if (params.skills !== undefined) {
    updates.push("skills = ?");
    values.push(serializeJsonField(params.skills));
  }
  if (params.certificate_id !== undefined) {
    updates.push("certificate_id = ?");
    values.push(params.certificate_id);
  }
  if (params.expiration_date !== undefined) {
    updates.push("expiration_date = ?");
    values.push(params.expiration_date);
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
    `UPDATE certifications SET ${updates.join(", ")} WHERE id = ?`,
    values as any[],
  );

  return getCertificationById(db, id);
}

export async function deleteCertification(
  db: DatabaseProvider,
  id: number,
): Promise<boolean> {
  const result = await db.execute("DELETE FROM certifications WHERE id = ?", [id]);
  return result.changes > 0;
}
