import { type Messages, type Locale } from "./config";

export async function loadMessages(locale: Locale): Promise<Messages> {
  return (await import(`../messages/${locale}.json`)).default;
}
