"use client";

import {
  normalizeReadingProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";

export const READING_PROGRESS_UPDATED_EVENT = "app:reading-progress-updated";

export type ReadingProgressUpdatedEvent = CustomEvent<{
  itemUuid: string;
  progress: ReadingProgress | null;
}>;

const READING_PROGRESS_CACHE_TTL_MS = 5_000;
const readingProgressCache = new Map<
  string,
  { expiresAt: number; progress: ReadingProgress | null }
>();
const readingProgressRequests = new Map<
  string,
  Promise<ReadingProgress | null>
>();
const readingProgressRevisions = new Map<string, number>();

export function fetchReadingProgress(itemUuid: string) {
  const cached = readingProgressCache.get(itemUuid);

  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.progress);
  }

  const pending = readingProgressRequests.get(itemUuid);

  if (pending) {
    return pending;
  }

  const revision = readingProgressRevisions.get(itemUuid) || 0;
  const request = fetch(
    `/api/neodb/progress?itemUuid=${encodeURIComponent(itemUuid)}`,
    { cache: "no-store" },
  )
    .then(async (response) => {
      if (!response.ok) {
        throw new Error("Reading progress fetch failed");
      }

      const progress = normalizeReadingProgress(await response.json());

      if ((readingProgressRevisions.get(itemUuid) || 0) !== revision) {
        return readingProgressCache.get(itemUuid)?.progress ?? progress;
      }

      cacheReadingProgress(itemUuid, progress);
      return progress;
    })
    .finally(() => {
      if (readingProgressRequests.get(itemUuid) === request) {
        readingProgressRequests.delete(itemUuid);
      }
    });

  readingProgressRequests.set(itemUuid, request);
  return request;
}

export function publishReadingProgressUpdate(
  itemUuid: string,
  progress: ReadingProgress | null,
) {
  readingProgressRevisions.set(
    itemUuid,
    (readingProgressRevisions.get(itemUuid) || 0) + 1,
  );
  cacheReadingProgress(itemUuid, progress);
  window.dispatchEvent(
    new CustomEvent(READING_PROGRESS_UPDATED_EVENT, {
      detail: { itemUuid, progress },
    }),
  );
}

export async function submitReadingProgress(
  itemUuid: string,
  progress: ReadingProgress | null,
) {
  const response = await fetch(
    progress
      ? "/api/neodb/progress"
      : `/api/neodb/progress?itemUuid=${encodeURIComponent(itemUuid)}`,
    progress
      ? {
          body: JSON.stringify({ itemUuid, ...progress }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        }
      : { method: "DELETE" },
  );
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error("Reading progress save failed");
  }

  const nextProgress = progress ? normalizeReadingProgress(payload) : null;

  publishReadingProgressUpdate(itemUuid, nextProgress);

  return nextProgress;
}

function cacheReadingProgress(
  itemUuid: string,
  progress: ReadingProgress | null,
) {
  readingProgressCache.set(itemUuid, {
    expiresAt: Date.now() + READING_PROGRESS_CACHE_TTL_MS,
    progress,
  });
}
