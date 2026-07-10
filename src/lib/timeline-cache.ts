"use client";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const TIMELINE_CACHE_PREFIX = `${STORAGE_PREFIX}v9:timeline:`;
const TIMELINE_ACTIVE_SCOPE_KEY = `${STORAGE_PREFIX}v9:timeline:active-scope`;
const TIMELINE_CACHE_TTL_MS = 10 * 60 * 1000;
const PUBLIC_TIMELINE_CACHE_TTL_MS = 30 * 60 * 1000;
const FOLLOWING_TIMELINE_CACHE_TTL_MS = 10 * 60 * 1000;

type TimelineCacheEntry<T> = {
  dirty: boolean;
  expiresAt: number;
  payload: T;
  savedAt: number;
};

export function readActiveTimelineCache<T>() {
  try {
    const scope = window.localStorage.getItem(TIMELINE_ACTIVE_SCOPE_KEY);
    if (!scope) return null;

    const raw = window.localStorage.getItem(getTimelineCacheKey(scope));
    if (!raw) return null;

    const entry = JSON.parse(raw) as TimelineCacheEntry<T>;
    if (!entry?.payload) {
      window.localStorage.removeItem(getTimelineCacheKey(scope));
      return null;
    }

    return {
      isDirty: Boolean(entry.dirty),
      isExpired: entry.expiresAt <= Date.now(),
      payload: entry.payload,
      scope,
    };
  } catch {
    return null;
  }
}

export function writeTimelineCache<T>(scope: string, payload: T) {
  try {
    window.localStorage.setItem(TIMELINE_ACTIVE_SCOPE_KEY, scope);
    window.localStorage.setItem(
      getTimelineCacheKey(scope),
      JSON.stringify({
        dirty: false,
        expiresAt: Date.now() + TIMELINE_CACHE_TTL_MS,
        payload,
        savedAt: Date.now(),
      } satisfies TimelineCacheEntry<T>),
    );
  } catch {
    // Timeline caching is an optional acceleration layer.
  }
}

export function readActivePublicTimelineCache<T>() {
  try {
    const scope = window.localStorage.getItem(TIMELINE_ACTIVE_SCOPE_KEY);
    if (!scope) return null;

    const key = getPublicTimelineCacheKey(scope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as TimelineCacheEntry<T>;
    if (!entry?.payload) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      isExpired: entry.expiresAt <= Date.now(),
      payload: entry.payload,
      scope,
    };
  } catch {
    return null;
  }
}

export function writePublicTimelineCache<T>(scope: string, payload: T) {
  try {
    window.localStorage.setItem(TIMELINE_ACTIVE_SCOPE_KEY, scope);
    window.localStorage.setItem(
      getPublicTimelineCacheKey(scope),
      JSON.stringify({
        dirty: false,
        expiresAt: Date.now() + PUBLIC_TIMELINE_CACHE_TTL_MS,
        payload,
        savedAt: Date.now(),
      } satisfies TimelineCacheEntry<T>),
    );
  } catch {
    // Public timeline caching is an optional acceleration layer.
  }
}

export function updatePublicTimelineCache<T>(
  scope: string,
  update: (payload: T) => T,
) {
  try {
    const key = getPublicTimelineCacheKey(scope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    const entry = JSON.parse(raw) as TimelineCacheEntry<T>;
    if (!entry?.payload) return;

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...entry, payload: update(entry.payload) }),
    );
  } catch {
    // Interaction updates do not need to block on local cache availability.
  }
}

export function readActiveFollowingTimelineCache<T>() {
  try {
    const scope = window.localStorage.getItem(TIMELINE_ACTIVE_SCOPE_KEY);
    if (!scope) return null;

    const key = getFollowingTimelineCacheKey(scope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;

    const entry = JSON.parse(raw) as TimelineCacheEntry<T>;
    if (!entry?.payload) {
      window.localStorage.removeItem(key);
      return null;
    }

    return {
      isDirty: Boolean(entry.dirty),
      isExpired: entry.expiresAt <= Date.now(),
      payload: entry.payload,
      scope,
    };
  } catch {
    return null;
  }
}

export function writeFollowingTimelineCache<T>(scope: string, payload: T) {
  try {
    window.localStorage.setItem(TIMELINE_ACTIVE_SCOPE_KEY, scope);
    window.localStorage.setItem(
      getFollowingTimelineCacheKey(scope),
      JSON.stringify({
        dirty: false,
        expiresAt: Date.now() + FOLLOWING_TIMELINE_CACHE_TTL_MS,
        payload,
        savedAt: Date.now(),
      } satisfies TimelineCacheEntry<T>),
    );
  } catch {
    // Following timeline caching is an optional acceleration layer.
  }
}

export function updateFollowingTimelineCache<T>(
  scope: string,
  update: (payload: T) => T,
) {
  try {
    const key = getFollowingTimelineCacheKey(scope);
    const raw = window.localStorage.getItem(key);
    if (!raw) return;

    const entry = JSON.parse(raw) as TimelineCacheEntry<T>;
    if (!entry?.payload) return;

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...entry, payload: update(entry.payload) }),
    );
  } catch {
    // Interaction updates do not need to block on local cache availability.
  }
}

export function invalidateTimelineCache() {
  try {
    const scope = window.localStorage.getItem(TIMELINE_ACTIVE_SCOPE_KEY);
    if (!scope) return;

    const key = getTimelineCacheKey(scope);
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const entry = JSON.parse(raw) as TimelineCacheEntry<unknown>;
      window.localStorage.setItem(key, JSON.stringify({ ...entry, dirty: true }));
    }

    const followingKey = getFollowingTimelineCacheKey(scope);
    const followingRaw = window.localStorage.getItem(followingKey);
    if (followingRaw) {
      const followingEntry = JSON.parse(
        followingRaw,
      ) as TimelineCacheEntry<unknown>;
      window.localStorage.setItem(
        followingKey,
        JSON.stringify({ ...followingEntry, dirty: true }),
      );
    }
  } catch {
    // Missing or malformed cache entries can be refreshed normally.
  }
}

export function clearTimelineCache() {
  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index);
      if (key?.startsWith(TIMELINE_CACHE_PREFIX)) {
        window.localStorage.removeItem(key);
      }
    }
    window.localStorage.removeItem(TIMELINE_ACTIVE_SCOPE_KEY);
  } catch {
    // Local storage may be unavailable.
  }
}

function getTimelineCacheKey(scope: string) {
  return `${TIMELINE_CACHE_PREFIX}${scope}`;
}

function getPublicTimelineCacheKey(scope: string) {
  return `${TIMELINE_CACHE_PREFIX}public:${scope}`;
}

function getFollowingTimelineCacheKey(scope: string) {
  return `${TIMELINE_CACHE_PREFIX}following:${scope}`;
}
