import type { DatabaseProvider } from "@/lib/database/types";

export interface NewsletterBannerSettings {
  is_visible: boolean;
  title: string;
  badge: string;
  description: string;
  button_text: string;
  placeholder: string;
}

export const DEFAULT_NEWSLETTER_BANNER: NewsletterBannerSettings = {
  is_visible: true,
  title: "Dev47 Future Insights",
  badge: "Newsletter",
  description:
    "Stay ahead of the curve. Get high-signal, zero-noise articles on modern web architecture, advanced UI/UX, and AI integrations delivered straight to your inbox.",
  button_text: "Subscribe",
  placeholder: "name@example.com",
};

export async function getSetting<T>(
  db: DatabaseProvider,
  key: string,
  defaultValue: T,
): Promise<T> {
  try {
    const rows = await db.query<{ key: string; value: string }>(
      "SELECT key, value FROM site_settings WHERE key = ?",
      [key],
    );
    if (rows.length === 0 || !rows[0].value) {
      return defaultValue;
    }
    return JSON.parse(rows[0].value) as T;
  } catch (error) {
    console.error(`Failed to get setting ${key}:`, error);
    return defaultValue;
  }
}

export async function setSetting<T>(
  db: DatabaseProvider,
  key: string,
  value: T,
): Promise<void> {
  const serialized = JSON.stringify(value);
  const existing = await db.query<{ key: string }>(
    "SELECT key FROM site_settings WHERE key = ?",
    [key],
  );

  if (existing.length > 0) {
    await db.execute(
      "UPDATE site_settings SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ?",
      [serialized, key],
    );
  } else {
    await db.execute(
      "INSERT INTO site_settings (key, value) VALUES (?, ?)",
      [key, serialized],
    );
  }
}

export async function getNewsletterBannerSettings(
  db: DatabaseProvider,
): Promise<NewsletterBannerSettings> {
  return getSetting<NewsletterBannerSettings>(
    db,
    "newsletter_banner",
    DEFAULT_NEWSLETTER_BANNER,
  );
}

export async function updateNewsletterBannerSettings(
  db: DatabaseProvider,
  settings: Partial<NewsletterBannerSettings>,
): Promise<NewsletterBannerSettings> {
  const current = await getNewsletterBannerSettings(db);
  const updated: NewsletterBannerSettings = {
    is_visible:
      settings.is_visible !== undefined
        ? Boolean(settings.is_visible)
        : current.is_visible,
    title:
      typeof settings.title === "string" && settings.title.trim()
        ? settings.title.trim()
        : current.title,
    badge:
      typeof settings.badge === "string" && settings.badge.trim()
        ? settings.badge.trim()
        : current.badge,
    description:
      typeof settings.description === "string" && settings.description.trim()
        ? settings.description.trim()
        : current.description,
    button_text:
      typeof settings.button_text === "string" && settings.button_text.trim()
        ? settings.button_text.trim()
        : current.button_text || "Subscribe",
    placeholder:
      typeof settings.placeholder === "string" && settings.placeholder.trim()
        ? settings.placeholder.trim()
        : current.placeholder || "name@example.com",
  };
  await setSetting(db, "newsletter_banner", updated);
  return updated;
}
