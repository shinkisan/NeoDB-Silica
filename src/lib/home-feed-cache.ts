import { personalHomeTagIds } from "@/lib/home-tags";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

/**
 * Keys for the home feed caches. Everything hangs off one prefix so the
 * existing sweeps — clearing other categories on refresh, taking a dismissed
 * item out of every rail, and the app-wide cache reset — keep covering new
 * entries without knowing about them.
 */
export const HOME_FEED_CACHE_PREFIX = `${STORAGE_PREFIX}v1:neodb:trending:`;

const PERSONAL_FEED_SCOPE_PREFIX = `${HOME_FEED_CACHE_PREFIX}${personalHomeTagIds[0]}:`;

/** Cache key for a public category feed. */
export function getHomeFeedCacheKey(category: string, locale: string) {
  return `${HOME_FEED_CACHE_PREFIX}${category}:${locale}`;
}

/**
 * Cache key for the personal feed, scoped to one session: a shared device must
 * never hand one account's picks to the next one, so the scope is derived from
 * the session itself rather than from the device.
 */
export function getPersonalHomeFeedCacheKey(scope: string, locale: string) {
  return `${PERSONAL_FEED_SCOPE_PREFIX}${scope}:${locale}`;
}

/** Drops every personal feed entry, for logout. */
export function clearPersonalHomeFeedCache() {
  if (typeof window === "undefined") {
    return;
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(PERSONAL_FEED_SCOPE_PREFIX)) {
      window.localStorage.removeItem(key);
    }
  }
}
