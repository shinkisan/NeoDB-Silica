"use client";

import type {
  ReadingProgress,
  ReadingProgressType,
} from "@/lib/reading-progress";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export const READING_PROGRESS_TOTAL_UPDATED_EVENT =
  "app:reading-progress-total-updated";

export type ReadingProgressTotalType = Exclude<
  ReadingProgressType,
  "percentage"
>;
export type ReadingProgressTotalSource = "google" | "item" | "manual";

export type ReadingProgressTotal = {
  source: ReadingProgressTotalSource;
  value: number;
};

type ReadingProgressTotals = Partial<
  Record<ReadingProgressTotalType, ReadingProgressTotal>
>;

export type ReadingProgressTotalUpdatedEvent = CustomEvent<{
  itemUuid: string;
  scope: string;
  totals: ReadingProgressTotals;
}>;

const STORAGE_KEY_PREFIX = `${STORAGE_PREFIX}v1:reading-progress-total:`;

export function readReadingProgressTotals(scope: string, itemUuid: string) {
  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(getStorageKey(scope, itemUuid)) || "{}",
    ) as ReadingProgressTotals;

    return normalizeTotals(parsed);
  } catch {
    return {};
  }
}

export function writeReadingProgressTotal(
  scope: string,
  itemUuid: string,
  type: ReadingProgressTotalType,
  value: number,
  source: ReadingProgressTotalSource,
) {
  const normalizedValue = normalizeTotalValue(value);

  if (!normalizedValue) {
    return readReadingProgressTotals(scope, itemUuid);
  }

  const totals = readReadingProgressTotals(scope, itemUuid);
  const current = totals[type];

  if (
    current?.source === "manual" &&
    source !== "manual"
  ) {
    return totals;
  }

  if (current?.source === "item" && source === "google") {
    return totals;
  }

  const nextTotals = {
    ...totals,
    [type]: { source, value: normalizedValue },
  };

  persistTotals(scope, itemUuid, nextTotals);
  return nextTotals;
}

export function clearReadingProgressTotals(scope: string, itemUuid: string) {
  try {
    window.localStorage.removeItem(getStorageKey(scope, itemUuid));
  } catch {
    // Local storage is an optional enhancement.
  }

  publishUpdate(scope, itemUuid, {});
}

export function getReadingProgressRatio(
  progress: ReadingProgress | null | undefined,
  totals: ReadingProgressTotals,
) {
  if (!progress) {
    return null;
  }

  const current = Number(progress.value);

  if (!Number.isFinite(current) || current < 0) {
    return null;
  }

  if (progress.type === "percentage") {
    return Math.min(1, current / 100);
  }

  const total = totals[progress.type]?.value;

  if (!total || total <= 0) {
    return null;
  }

  return Math.min(1, current / total);
}

function persistTotals(
  scope: string,
  itemUuid: string,
  totals: ReadingProgressTotals,
) {
  try {
    window.localStorage.setItem(
      getStorageKey(scope, itemUuid),
      JSON.stringify(totals),
    );
  } catch {
    // Local storage is an optional enhancement.
  }

  publishUpdate(scope, itemUuid, totals);
}

function publishUpdate(
  scope: string,
  itemUuid: string,
  totals: ReadingProgressTotals,
) {
  window.dispatchEvent(
    new CustomEvent(READING_PROGRESS_TOTAL_UPDATED_EVENT, {
      detail: { itemUuid, scope, totals },
    }),
  );
}

function normalizeTotals(value: ReadingProgressTotals) {
  const totals: ReadingProgressTotals = {};

  for (const type of ["page", "chapter"] as const) {
    const entry = value?.[type];
    const normalizedValue = normalizeTotalValue(entry?.value);

    if (
      normalizedValue &&
      (entry?.source === "google" ||
        entry?.source === "item" ||
        entry?.source === "manual")
    ) {
      totals[type] = { source: entry.source, value: normalizedValue };
    }
  }

  return totals;
}

function normalizeTotalValue(value: unknown) {
  const numericValue = Number(value);

  return Number.isFinite(numericValue) && numericValue > 0
    ? numericValue
    : null;
}

function getStorageKey(scope: string, itemUuid: string) {
  return `${STORAGE_KEY_PREFIX}${scope}:${itemUuid}`;
}
