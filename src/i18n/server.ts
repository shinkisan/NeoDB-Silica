import { loadMessages } from "./messages";
import { type Messages } from "./config";
import { resolveRequestLocale } from "./resolve-locale";

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
  const locale = await resolveRequestLocale();
  const messages = await loadMessages(locale);
  return (key: string) => tFromMessages(messages, key);
}

export async function getLocale() {
  return resolveRequestLocale();
}
