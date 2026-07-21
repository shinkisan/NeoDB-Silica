"use client";

import type { ShelfType } from "@/components/mark-badges";
import type { HomeItem } from "@/lib/neodb";
import type { ReadingProgress } from "@/lib/reading-progress";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export const MARKED_LIST_CACHE_PREFIX = `${STORAGE_PREFIX}v1:marked-list:`;
export const MARKED_LIST_ACTIVE_SCOPE_KEY = `${STORAGE_PREFIX}v1:marked-list:active-scope`;
const MARKED_LIST_CACHE_TTL_MS = 10 * 60 * 1000;
const MARKED_LIST_CACHE_LIMIT = 48;

export type MarkedListItem = {
  item: HomeItem;
  mark: {
    comment_text?: string | null;
    created_time?: string | null;
    item: {
      category: string;
      uuid: string;
    };
    rating_grade?: number | null;
    reading_progress?: ReadingProgress | null;
    shelf_type: ShelfType;
  };
};

export type MarkedListPayload = {
  count: number;
  items: MarkedListItem[];
  pages: number;
};

type CacheEntry = {
  expiresAt: number;
  payload: MarkedListPayload;
  savedAt: number;
};

export function setActiveMarkedListScope(scope: string) {
  try {
    window.localStorage.setItem(MARKED_LIST_ACTIVE_SCOPE_KEY, scope);
  } catch {
    // Local storage is an optional acceleration layer.
  }
}

export function readMarkedListCache(
  scope: string,
  shelf: ShelfType,
  category: string,
  page: number,
) {
  try {
    const key = getCacheKey(scope, shelf, category, page);
    const raw = window.localStorage.getItem(key);

    if (!raw) {
      return null;
    }

    const entry = JSON.parse(raw) as CacheEntry;

    if (
      !entry?.payload ||
      !Array.isArray(entry.payload.items) ||
      entry.expiresAt <= Date.now()
    ) {
      window.localStorage.removeItem(key);
      return null;
    }

    return entry.payload;
  } catch {
    return null;
  }
}

export function writeMarkedListCache(
  scope: string,
  shelf: ShelfType,
  category: string,
  page: number,
  payload: MarkedListPayload,
) {
  try {
    pruneMarkedListCache(scope);
    window.localStorage.setItem(
      getCacheKey(scope, shelf, category, page),
      JSON.stringify({
        expiresAt: Date.now() + MARKED_LIST_CACHE_TTL_MS,
        payload,
        savedAt: Date.now(),
      } satisfies CacheEntry),
    );
  } catch {
    // Local storage is an optional acceleration layer.
  }
}

export function invalidateMarkedListShelves(shelves: Array<ShelfType | null>) {
  let scope: string | null = null;

  try {
    scope = window.localStorage.getItem(MARKED_LIST_ACTIVE_SCOPE_KEY);
  } catch {
    return;
  }

  if (!scope) {
    return;
  }

  const shelfSet = new Set(shelves.filter((shelf): shelf is ShelfType => Boolean(shelf)));

  removeMarkedListKeys((key) =>
    [...shelfSet].some((shelf) =>
      key.startsWith(`${MARKED_LIST_CACHE_PREFIX}${scope}:${shelf}:`),
    ),
  );
}

export function clearMarkedListCategoryCache(
  scope: string,
  shelf: ShelfType,
  category: string,
) {
  const prefix = `${MARKED_LIST_CACHE_PREFIX}${scope}:${shelf}:${category}:`;

  try {
    removeMarkedListKeys((key) => key.startsWith(prefix));
  } catch {
    // Local storage is an optional acceleration layer.
  }
}

export function updateMarkedListProgress(
  itemUuid: string,
  progress: ReadingProgress | null,
) {
  let scope: string | null = null;

  try {
    scope = window.localStorage.getItem(MARKED_LIST_ACTIVE_SCOPE_KEY);
  } catch {
    return;
  }

  if (!scope) {
    return;
  }

  const prefix = `${MARKED_LIST_CACHE_PREFIX}${scope}:`;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(prefix)) {
      continue;
    }

    try {
      const raw = window.localStorage.getItem(key);
      const entry = raw ? (JSON.parse(raw) as CacheEntry) : null;

      if (!entry?.payload?.items) {
        continue;
      }

      let changed = false;
      const items = entry.payload.items.map((listItem) => {
        if (listItem.mark.item.uuid !== itemUuid) {
          return listItem;
        }

        changed = true;
        return {
          ...listItem,
          mark: {
            ...listItem.mark,
            reading_progress: progress,
          },
        };
      });

      if (changed) {
        window.localStorage.setItem(
          key,
          JSON.stringify({
            ...entry,
            payload: { ...entry.payload, items },
            savedAt: Date.now(),
          } satisfies CacheEntry),
        );
      }
    } catch {
      // Leave unrelated cached pages intact if one entry is malformed.
    }
  }
}

export function clearMarkedListCache(scope?: string) {
  try {
    const prefix = scope
      ? `${MARKED_LIST_CACHE_PREFIX}${scope}:`
      : MARKED_LIST_CACHE_PREFIX;

    removeMarkedListKeys((key) => key.startsWith(prefix));

    if (
      !scope ||
      window.localStorage.getItem(MARKED_LIST_ACTIVE_SCOPE_KEY) === scope
    ) {
      window.localStorage.removeItem(MARKED_LIST_ACTIVE_SCOPE_KEY);
    }
  } catch {
    // Local storage is an optional acceleration layer.
  }
}

function getCacheKey(
  scope: string,
  shelf: ShelfType,
  category: string,
  page: number,
) {
  return `${MARKED_LIST_CACHE_PREFIX}${scope}:${shelf}:${category}:${page}`;
}

function pruneMarkedListCache(scope: string) {
  const entries: Array<{ key: string; savedAt: number }> = [];
  const prefix = `${MARKED_LIST_CACHE_PREFIX}${scope}:`;

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(prefix)) {
      continue;
    }

    try {
      const entry = JSON.parse(window.localStorage.getItem(key) || "") as CacheEntry;

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
    .slice(MARKED_LIST_CACHE_LIMIT - 1)
    .forEach((entry) => window.localStorage.removeItem(entry.key));
}

function removeMarkedListKeys(predicate: (key: string) => boolean) {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key && predicate(key)) {
      window.localStorage.removeItem(key);
    }
  }
}
