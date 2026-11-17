import type { DatabaseProvider } from "@/lib/database/types";
import crypto from "node:crypto";

export interface NewsletterSubscriber extends Record<string, unknown> {
  id: number;
  email: string;
  status: "pending" | "active" | "unsubscribed";
  confirmation_token: string | null;
  confirmed_at: string | null;
  unsubscribe_token: string;
  source: string;
  created_at: string;
  updated_at: string;
}

export function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export async function findSubscriberByEmail(
  db: DatabaseProvider,
  email: string,
): Promise<NewsletterSubscriber | null> {
  const normalized = email.trim().toLowerCase();
  const rows = await db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers WHERE LOWER(email) = ?",
    [normalized],
  );
  return rows[0] ?? null;
}

export async function createOrReactivateSubscriber(
  db: DatabaseProvider,
  email: string,
  source = "blog_banner",
): Promise<{ subscriber: NewsletterSubscriber; isNew: boolean; alreadyActive: boolean }> {
  const normalized = email.trim().toLowerCase();
  const existing = await findSubscriberByEmail(db, normalized);

  if (existing) {
    if (existing.status === "active") {
      return { subscriber: existing, isNew: false, alreadyActive: true };
    }

    // Reactivate: generate fresh confirmation token
    const newConfirmToken = generateSecureToken();
    await db.execute(
      "UPDATE newsletter_subscribers SET status = 'pending', confirmation_token = ?, source = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [newConfirmToken, source, existing.id],
    );

    const updated = await db.query<NewsletterSubscriber>(
      "SELECT * FROM newsletter_subscribers WHERE id = ?",
      [existing.id],
    );
    return { subscriber: updated[0], isNew: false, alreadyActive: false };
  }

  // Create new pending subscriber
  const confirmToken = generateSecureToken();
  const unsubToken = generateSecureToken();

  await db.execute(
    `INSERT INTO newsletter_subscribers (email, status, confirmation_token, unsubscribe_token, source)
     VALUES (?, 'pending', ?, ?, ?)`,
    [normalized, confirmToken, unsubToken, source],
  );

  const created = await findSubscriberByEmail(db, normalized);
  if (!created) {
    throw new Error("Failed to create newsletter subscriber record");
  }

  return { subscriber: created, isNew: true, alreadyActive: false };
}

export async function confirmSubscriberByToken(
  db: DatabaseProvider,
  token: string,
): Promise<NewsletterSubscriber | null> {
  if (!token || typeof token !== "string") return null;

  const rows = await db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers WHERE confirmation_token = ?",
    [token.trim()],
  );

  const subscriber = rows[0];
  if (!subscriber) return null;

  if (subscriber.status === "active") {
    return subscriber;
  }

  await db.execute(
    "UPDATE newsletter_subscribers SET status = 'active', confirmed_at = CURRENT_TIMESTAMP, confirmation_token = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [subscriber.id],
  );

  const updated = await db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers WHERE id = ?",
    [subscriber.id],
  );
  return updated[0] ?? null;
}

export async function unsubscribeByToken(
  db: DatabaseProvider,
  token: string,
): Promise<NewsletterSubscriber | null> {
  if (!token || typeof token !== "string") return null;

  const rows = await db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers WHERE unsubscribe_token = ?",
    [token.trim()],
  );

  const subscriber = rows[0];
  if (!subscriber) return null;

  if (subscriber.status === "unsubscribed") {
    return subscriber;
  }

  await db.execute(
    "UPDATE newsletter_subscribers SET status = 'unsubscribed', updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    [subscriber.id],
  );

  const updated = await db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers WHERE id = ?",
    [subscriber.id],
  );
  return updated[0] ?? null;
}

export async function getNewsletterSubscribersList(
  db: DatabaseProvider,
  status?: string,
): Promise<NewsletterSubscriber[]> {
  if (status && status !== "all") {
    return db.query<NewsletterSubscriber>(
      "SELECT * FROM newsletter_subscribers WHERE status = ? ORDER BY created_at DESC",
      [status],
    );
  }
  return db.query<NewsletterSubscriber>(
    "SELECT * FROM newsletter_subscribers ORDER BY created_at DESC",
  );
}

export async function getNewsletterSubscribersStats(
  db: DatabaseProvider,
): Promise<{ total: number; active: number; pending: number; unsubscribed: number }> {
  const rows = await db.query<{ status: string; count: number }>(
    "SELECT status, COUNT(*) as count FROM newsletter_subscribers GROUP BY status",
  );

  let total = 0;
  let active = 0;
  let pending = 0;
  let unsubscribed = 0;

  for (const r of rows) {
    total += Number(r.count);
    if (r.status === "active") active = Number(r.count);
    else if (r.status === "pending") pending = Number(r.count);
    else if (r.status === "unsubscribed") unsubscribed = Number(r.count);
  }

  return { total, active, pending, unsubscribed };
}
