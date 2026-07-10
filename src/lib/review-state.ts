import { STORAGE_PREFIX } from "@/lib/runtime-ids";
export const REVIEW_STATE_EVENT = "app:review-state";

const REVIEW_STATE_PREFIX = `${STORAGE_PREFIX}v1:review-state:`;
const REVIEW_STATE_TTL_MS = 10 * 60 * 1000;

export type ReviewStateSnapshot = {
  hasReview: boolean;
  itemUuid: string;
  savedAt?: number;
};

export type ReviewStateEvent = CustomEvent<ReviewStateSnapshot>;

export function dispatchReviewStateChange(itemUuid: string, hasReview: boolean) {
  const snapshot = writeReviewStateSnapshot({ hasReview, itemUuid });

  window.dispatchEvent(
    new CustomEvent<ReviewStateSnapshot>(REVIEW_STATE_EVENT, {
      detail: snapshot,
    }),
  );
}

export function readReviewStateSnapshot(itemUuid: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSnapshot = window.sessionStorage.getItem(
    `${REVIEW_STATE_PREFIX}${itemUuid}`,
  );

  if (!rawSnapshot) {
    return null;
  }

  try {
    const snapshot = JSON.parse(rawSnapshot) as ReviewStateSnapshot;

    if (snapshot.itemUuid !== itemUuid) {
      return null;
    }

    if (
      typeof snapshot.savedAt === "number" &&
      Date.now() - snapshot.savedAt > REVIEW_STATE_TTL_MS
    ) {
      window.sessionStorage.removeItem(`${REVIEW_STATE_PREFIX}${itemUuid}`);
      return null;
    }

    return snapshot;
  } catch {
    window.sessionStorage.removeItem(`${REVIEW_STATE_PREFIX}${itemUuid}`);
    return null;
  }
}

export function writeReviewStateSnapshot(snapshot: ReviewStateSnapshot) {
  const nextSnapshot = { ...snapshot, savedAt: Date.now() };

  if (typeof window === "undefined") {
    return nextSnapshot;
  }

  try {
    window.sessionStorage.setItem(
      `${REVIEW_STATE_PREFIX}${snapshot.itemUuid}`,
      JSON.stringify(nextSnapshot),
    );
  } catch {
    // The event still updates mounted consumers in the current page.
  }

  return nextSnapshot;
}
