"use client";

const CACHE_PREFIX = "bielu:v2:comment-translation:";
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_LIMIT = 100;

type TranslationCacheEntry = {
  expiresAt: number;
  savedAt: number;
  sourceText: string;
  translatedText: string;
};

export function readCommentTranslation(
  sourceText: string,
  targetLanguage: string,
) {
  try {
    const key = getCacheKey(sourceText, targetLanguage);
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as TranslationCacheEntry;

    if (
      entry.sourceText !== sourceText ||
      !entry.translatedText ||
      entry.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return entry.translatedText;
  } catch {
    return null;
  }
}

export function writeCommentTranslation(
  sourceText: string,
  targetLanguage: string,
  translatedText: string,
) {
  try {
    pruneTranslationCache();
    const now = Date.now();

    window.localStorage.setItem(
      getCacheKey(sourceText, targetLanguage),
      JSON.stringify({
        expiresAt: now + CACHE_TTL_MS,
        savedAt: now,
        sourceText,
        translatedText,
      } satisfies TranslationCacheEntry),
    );
  } catch {
    // Translation still works when local storage is unavailable.
  }
}

function getCacheKey(sourceText: string, targetLanguage: string) {
  return `${CACHE_PREFIX}${targetLanguage}:${fingerprint(sourceText)}`;
}

function fingerprint(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function pruneTranslationCache() {
  const entries: Array<{ key: string; savedAt: number }> = [];

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(CACHE_PREFIX)) {
      continue;
    }

    try {
      const entry = JSON.parse(
        window.localStorage.getItem(key) || "",
      ) as TranslationCacheEntry;

      if (entry.expiresAt <= Date.now()) {
        window.localStorage.removeItem(key);
      } else {
        entries.push({ key, savedAt: entry.savedAt || 0 });
      }
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  entries
    .sort((left, right) => right.savedAt - left.savedAt)
    .slice(CACHE_LIMIT - 1)
    .forEach((entry) => window.localStorage.removeItem(entry.key));
}
