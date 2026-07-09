export type Messages = Record<string, Record<string, string>>;

export const locales = ["zh-Hans", "zh-Hant", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "zh-Hans";
