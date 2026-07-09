import { cookies } from "next/headers";
import { type Locale, defaultLocale, locales } from "./config";
import { loadMessages } from "./messages";
import { type Messages } from "./config";

function resolveLocale(
  cookieStore: Awaited<ReturnType<typeof cookies>>,
): Locale {
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  if (
    cookieLocale &&
    (locales as readonly string[]).includes(cookieLocale)
  ) {
    return cookieLocale as Locale;
  }

  return defaultLocale;
}

function tFromMessages(messages: Messages, key: string): string {
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

export async function getT() {
  const locale = resolveLocale(await cookies());
  const messages = await loadMessages(locale);
  return (key: string) => tFromMessages(messages, key);
}

export async function getLocale() {
  return resolveLocale(await cookies());
}
