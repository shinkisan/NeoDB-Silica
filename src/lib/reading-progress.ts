export const readingProgressTypes = ["page", "chapter", "percentage"] as const;

export type ReadingProgressType = (typeof readingProgressTypes)[number];

export type ReadingProgress = {
  type: ReadingProgressType;
  value: string;
};

export function normalizeReadingProgress(value: unknown): ReadingProgress | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { type?: unknown; value?: unknown };
  const type = candidate.type;
  const progressValue =
    typeof candidate.value === "string" ? candidate.value.trim() : "";

  if (
    !readingProgressTypes.includes(type as ReadingProgressType) ||
    !progressValue
  ) {
    return null;
  }

  return {
    type: type as ReadingProgressType,
    value: progressValue,
  };
}

export function formatReadingProgressShort(
  progress: ReadingProgress | null | undefined,
  t: (key: string) => string,
) {
  if (!progress?.value) {
    return "";
  }

  const value = progress.value.slice(0, 16);
  return t(`mark.readingProgress.short.${progress.type}`).replace(
    "{value}",
    value,
  );
}

export function isValidReadingProgressValue(
  type: ReadingProgressType,
  value: string,
) {
  const normalized = value.trim();

  if (!/^\d+(?:\.\d+)?$/.test(normalized)) {
    return false;
  }

  const numericValue = Number(normalized);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    return false;
  }

  return type !== "percentage" || numericValue <= 100;
}
