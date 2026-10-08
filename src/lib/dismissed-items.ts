"use client";

import type { HomeItem } from "@/lib/neodb";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export const DISMISSED_ITEMS_KEY = `${STORAGE_PREFIX}v1:dismissed-items`;

/** Old beyond this and the record is pruned from the tail. */
const MAX_DISMISSED_ITEMS = 200;

/**
 * An item the visitor told the home feed to stop showing.
 *
 * NeoDB's API can dismiss and restore one item, but has no endpoint that lists
 * them (`/api/me/recommendations` excludes dismissed items, and the site's own
 * list is a session-rendered page), so the record is kept here for the profile
 * page. It only covers what this app dismissed on this device; a future API
 * could replace this module without touching the page.
 */
export type DismissedItem = Pick<
  HomeItem,
  | "category"
  | "coverUrl"
  | "creator"
  | "detailPath"
  | "id"
  | "kind"
  | "rating"
  | "title"
> & {
  dismissedAt: number;
};

function isDismissedItem(value: unknown): value is DismissedItem {
  if (!value || typeof value !== "object") {
    return false;
  }

  const entry = value as Partial<DismissedItem>;

  return (
    typeof entry.id === "string" &&
    entry.id.length > 0 &&
    typeof entry.title === "string" &&
    typeof entry.detailPath === "string"
  );
}

export function readDismissedItems(): DismissedItem[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(
      window.localStorage.getItem(DISMISSED_ITEMS_KEY) || "[]",
    );

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isDismissedItem).sort((a, b) => b.dismissedAt - a.dismissedAt);
  } catch {
    return [];
  }
}

function writeDismissedItems(items: DismissedItem[]) {
  try {
    window.localStorage.setItem(
      DISMISSED_ITEMS_KEY,
      JSON.stringify(items.slice(0, MAX_DISMISSED_ITEMS)),
    );
  } catch {
    // A full or unavailable store just means the record is not kept.
  }
}

/** Records a dismissal, stamped now. The timestamp belongs to the record. */
export function addDismissedItem(item: Omit<DismissedItem, "dismissedAt">) {
  if (typeof window === "undefined") {
    return;
  }

  const entry: DismissedItem = { ...item, dismissedAt: Date.now() };
  const withoutItem = readDismissedItems().filter((old) => old.id !== entry.id);

  writeDismissedItems([entry, ...withoutItem]);
}

export function removeDismissedItem(id: string) {
  if (typeof window === "undefined") {
    return;
  }

  writeDismissedItems(readDismissedItems().filter((entry) => entry.id !== id));
}

/** Drops the record, for logout: it belongs to the session that made it. */
export function clearDismissedItems() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(DISMISSED_ITEMS_KEY);
  } catch {
    // Nothing to do if the store is unavailable.
  }
}
