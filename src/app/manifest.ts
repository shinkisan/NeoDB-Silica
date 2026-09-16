import type { MetadataRoute } from "next";
import { resolveRequestLocale } from "@/i18n/resolve-locale";
import { siteConfig } from "@/site.config";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const locale = await resolveRequestLocale();
  const messages = (await import(`../messages/${locale}.json`)).default;
  const appDesc = getMessage(messages, "app.description") as string;

  return {
    name: siteConfig.name,
    short_name: siteConfig.name,
    description: appDesc,
    id: "/",
    start_url: "/",
    display: "standalone",
    // No theme_color on purpose. Android reads it for the status bar of an
    // installed app and it can only hold one value, fetched at install time,
    // so any choice here is wrong in one of the two themes. Leaving it out
    // lets the platform pick, and the theme-color meta still drives browser
    // tabs. iOS is unaffected either way: it uses its own status bar style.
    background_color: siteConfig.backgroundColor,
    shortcuts: [
      {
        icons: [
          {
            src: "/icons/shortcut-scan-book.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
        name: getMessage(messages, "app.shortcuts.scanBook"),
        url: "/?shortcut=scan-book",
      },
      {
        icons: [
          {
            src: "/icons/shortcut-search.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
        name: getMessage(messages, "app.shortcuts.searchItems"),
        url: "/?shortcut=search",
      },
      {
        icons: [
          {
            src: "/icons/shortcut-reading-progress.png",
            sizes: "96x96",
            type: "image/png",
          },
        ],
        name: getMessage(messages, "app.shortcuts.readingBooks"),
        url: "/marked?shelf=progress&category=book",
      },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
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
