import { type Locale, defaultLocale } from "./config";

export function detectLocaleFromAcceptLanguage(
  acceptLanguage: string | null,
): Locale {
  if (!acceptLanguage) {
    return defaultLocale;
  }

  const tags = acceptLanguage
    .split(",")
    .map((entry) => {
      const [tag, qValue] = entry.trim().split(";q=");
      const q = qValue ? Number.parseFloat(qValue) : 1;
      return { q: Number.isNaN(q) ? 1 : q, tag: tag.trim() };
    })
    .filter((entry) => entry.tag)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of tags) {
    const locale = matchLocale(tag);

    if (locale) {
      return locale;
    }
  }

  return defaultLocale;
}

function matchLocale(tag: string): Locale | null {
  const lower = tag.toLowerCase();

  if (!lower.startsWith("zh")) {
    return lower.startsWith("en") ? "en" : null;
  }

  // Traditional-Chinese-speaking regions/script subtags; everything else
  // "zh"-prefixed (zh-CN, zh-SG, bare "zh", zh-Hans, ...) maps to Simplified.
  if (
    lower.includes("hant") ||
    lower.endsWith("-tw") ||
    lower.endsWith("-hk") ||
    lower.endsWith("-mo")
  ) {
    return "zh-Hant";
  }

  return "zh-Hans";
}
