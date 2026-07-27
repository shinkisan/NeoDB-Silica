import { cookies, headers } from "next/headers";
import { type Locale, locales } from "./config";
import { detectLocaleFromAcceptLanguage } from "./detect-locale";

// Single source of truth for "what locale is this request in" - used both
// for the app's own UI strings (i18n/server.ts) and for the Accept-Language
// sent to the NeoDB API (lib/server-fetch.ts), so an unset NEXT_LOCALE
// cookie ("system default") resolves the same way in both places instead of
// silently falling back to a hardcoded locale in one of them.
export async function resolveRequestLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;

  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale as Locale;
  }

  const requestHeaders = await headers();
  return detectLocaleFromAcceptLanguage(requestHeaders.get("accept-language"));
}
