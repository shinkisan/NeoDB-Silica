import { type Locale } from "@/i18n/config";

export const TMDB_REGION_COOKIE = "bielu_tmdb_region";
export const TMDB_REGION_STORAGE_KEY = "bielu:v1:tmdb-region";

export const TMDB_REGIONS = [
  "CN",
  "TW",
  "HK",
  "MO",
  "JP",
  "KR",
  "SG",
  "MY",
  "US",
  "GB",
  "FR",
  "DE",
  "CA",
  "AU",
] as const;

export type TmdbRegion = (typeof TMDB_REGIONS)[number];

export function isTmdbRegion(value: string): value is TmdbRegion {
  return (TMDB_REGIONS as readonly string[]).includes(value);
}

export function getDefaultTmdbRegion(locale: Locale): TmdbRegion {
  if (locale === "zh-Hant") {
    return "TW";
  }

  if (locale === "en") {
    return "US";
  }

  return "CN";
}

export function getTmdbLanguageForRegion(region: TmdbRegion): string {
  const languageMap: Record<TmdbRegion, string> = {
    AU: "en-AU",
    CA: "en-CA",
    CN: "zh-CN",
    DE: "de-DE",
    FR: "fr-FR",
    GB: "en-GB",
    HK: "zh-HK",
    JP: "ja-JP",
    KR: "ko-KR",
    MO: "zh-HK",
    MY: "ms-MY",
    SG: "en-SG",
    TW: "zh-TW",
    US: "en-US",
  };

  return languageMap[region];
}

export function getTmdbPosterLanguagePreferences(region: TmdbRegion): string[] {
  const languageMap: Record<TmdbRegion, string[]> = {
    AU: ["en", "null"],
    CA: ["en", "fr", "null"],
    CN: ["zh", "null", "en"],
    DE: ["de", "null", "en"],
    FR: ["fr", "null", "en"],
    GB: ["en", "null"],
    HK: ["zh", "en", "null"],
    JP: ["ja", "null", "en"],
    KR: ["ko", "null", "en"],
    MO: ["zh", "en", "null"],
    MY: ["ms", "en", "zh", "null"],
    SG: ["en", "zh", "null"],
    TW: ["zh", "null", "en"],
    US: ["en", "null"],
  };

  return languageMap[region];
}
