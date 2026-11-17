import type { DatabaseProvider } from "@/lib/database/types";

export type BannerType = "form" | "html" | "image";

export interface NewsletterBannerSettings {
  is_visible: boolean;
  banner_type: BannerType;
  title: string;
  badge: string;
  description: string;
  button_text: string;
  placeholder: string;
  html_content: string;
  image_url: string;
  image_link: string;
  image_alt: string;
  image_position_x: number;
  image_position_y: number;
  image_scale: number;
}

export const DEFAULT_NEWSLETTER_BANNER: NewsletterBannerSettings = {
  is_visible: true,
  banner_type: "form",
  title: "Dev47 Future Insights",
  badge: "Newsletter",
  description:
    "Stay ahead of the curve. Get high-signal, zero-noise articles on modern web architecture, advanced UI/UX, and AI integrations delivered straight to your inbox.",
  button_text: "Subscribe",
  placeholder: "name@example.com",
  html_content: `<div class="p-8 text-center bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white rounded-2xl shadow-lg">
  <h2 class="text-2xl sm:text-3xl font-extrabold mb-2">Exclusive Modern Web Architecture Guide</h2>
  <p class="text-sm sm:text-base opacity-90 max-w-xl mx-auto mb-4">Discover production-ready serverless patterns, edge compute, and high-performance UI systems.</p>
  <span class="inline-block px-4 py-2 bg-white text-indigo-700 font-bold rounded-xl text-sm shadow hover:bg-opacity-90">Read Now →</span>
</div>`,
  image_url: "",
  image_link: "",
  image_alt: "Dev47 Announcement Banner",
  image_position_x: 50,
  image_position_y: 50,
  image_scale: 1,
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
  const settings = await getSetting<Partial<NewsletterBannerSettings>>(
    db,
    "newsletter_banner",
    DEFAULT_NEWSLETTER_BANNER,
  );
  return {
    ...DEFAULT_NEWSLETTER_BANNER,
    ...settings,
    banner_type:
      settings.banner_type === "html" || settings.banner_type === "image"
        ? settings.banner_type
        : "form",
    image_position_x:
      typeof settings.image_position_x === "number"
        ? Math.max(0, Math.min(100, settings.image_position_x))
        : 50,
    image_position_y:
      typeof settings.image_position_y === "number"
        ? Math.max(0, Math.min(100, settings.image_position_y))
        : 50,
    image_scale:
      typeof settings.image_scale === "number"
        ? Math.max(1, Math.min(3, settings.image_scale))
        : 1,
  };
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
    banner_type:
      settings.banner_type === "html" || settings.banner_type === "image"
        ? settings.banner_type
        : settings.banner_type === "form"
        ? "form"
        : current.banner_type || "form",
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
    html_content:
      typeof settings.html_content === "string"
        ? settings.html_content
        : current.html_content || "",
    image_url:
      typeof settings.image_url === "string"
        ? settings.image_url.trim()
        : current.image_url || "",
    image_link:
      typeof settings.image_link === "string"
        ? settings.image_link.trim()
        : current.image_link || "",
    image_alt:
      typeof settings.image_alt === "string"
        ? settings.image_alt.trim()
        : current.image_alt || "Dev47 Banner",
    image_position_x:
      typeof settings.image_position_x === "number"
        ? Math.max(0, Math.min(100, Math.round(settings.image_position_x)))
        : current.image_position_x ?? 50,
    image_position_y:
      typeof settings.image_position_y === "number"
        ? Math.max(0, Math.min(100, Math.round(settings.image_position_y)))
        : current.image_position_y ?? 50,
    image_scale:
      typeof settings.image_scale === "number"
        ? Math.max(1, Math.min(3, Number(settings.image_scale.toFixed(2))))
        : current.image_scale ?? 1,
  };
  await setSetting(db, "newsletter_banner", updated);
  return updated;
}
