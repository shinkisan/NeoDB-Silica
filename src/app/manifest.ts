import type { MetadataRoute } from "next";
import { cookies } from "next/headers";
import { defaultLocale, locales } from "@/i18n/config";
import { getDefaultThemeColor } from "@/lib/theme";
import { siteConfig } from "@/site.config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = resolveLocale(await cookies());
  const messages = (await import(`../messages/${locale}.json`)).default;
  const appDesc = getMessage(messages, "app.description") as string;

  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: appDesc,
    id: "/",
    start_url: "/",
    display: "standalone",
    background_color: siteConfig.backgroundColor,
    theme_color: getDefaultThemeColor().primary,
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

function resolveLocale(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): string {
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  if (
    cookieLocale &&
    (locales as readonly string[]).includes(cookieLocale)
  ) {
    return cookieLocale;
  }

  return defaultLocale;
}

function getMessage(messages: Record<string, unknown>, key: string): string {
  const parts = key.split(".");
  let current: unknown = messages;

  for (const part of parts) {
    if (current == null || typeof current !== "object") {
      return key;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return typeof current === "string" ? current : key;
}
