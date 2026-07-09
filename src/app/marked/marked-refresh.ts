export const MARKED_REFRESH_ITEM_EVENT = "bielu:marked-refresh-item";
export const MARKED_REFRESH_ITEM_KEY = "bielu:v1:marked:refresh-item";
export const MARKED_ITEM_SNAPSHOT_PREFIX = "bielu:v1:marked:item-snapshot:";
const MARKED_ITEM_SNAPSHOT_TTL_MS = 10 * 60 * 1000;

export type MarkedRefreshItemEvent = CustomEvent<{ itemUuid: string }>;

export type MarkedItemSnapshot = {
  commentText?: string;
  createdTime?: string;
  itemUuid: string;
  ratingGrade?: number;
  savedAt?: number;
  shelfType?: string | null;
  tags?: string[];
};

export function readMarkedItemSnapshot(itemUuid: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${MARKED_ITEM_SNAPSHOT_PREFIX}${itemUuid}`;
  const rawSnapshot = window.sessionStorage.getItem(key);

  if (!rawSnapshot) {
    return null;
  }

  try {
    const snapshot = JSON.parse(rawSnapshot) as MarkedItemSnapshot;

    if (snapshot.itemUuid !== itemUuid) {
      return null;
    }

    if (
      typeof snapshot.savedAt === "number" &&
      Date.now() - snapshot.savedAt > MARKED_ITEM_SNAPSHOT_TTL_MS
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return snapshot;
  } catch {
    return null;
  }
}

export function writeMarkedItemSnapshot(snapshot: MarkedItemSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${MARKED_ITEM_SNAPSHOT_PREFIX}${snapshot.itemUuid}`,
      JSON.stringify({ ...snapshot, savedAt: Date.now() }),
    );
  } catch {
    // Focused marked-page refresh can still fall back to the NeoDB mark API.
  }
}
