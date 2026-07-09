import {
  normalizeNeodbVisibility,
  type NeodbVisibility,
} from "@/lib/neodb-visibility";

export const PUBLISH_PREFERENCES_EVENT = "bielu:publish-preferences";
const PUBLISH_PREFERENCES_KEY = "bielu:v1:publish-preferences";

export type PublishVisibilityTarget = "mark" | "review";
export type PublishFediverseTarget = "mark" | "comment" | "review";

export type PublishPreferences = {
  fediverse: Record<PublishFediverseTarget, boolean>;
  visibility: Record<PublishVisibilityTarget, NeodbVisibility>;
};

export const defaultPublishPreferences: PublishPreferences = {
  fediverse: {
    comment: false,
    mark: false,
    review: false,
  },
  visibility: {
    mark: 0,
    review: 0,
  },
};

export function readPublishPreferences(): PublishPreferences {
  if (typeof window === "undefined") {
    return defaultPublishPreferences;
  }

  const raw = window.localStorage.getItem(PUBLISH_PREFERENCES_KEY);

  if (!raw) {
    return defaultPublishPreferences;
  }

  try {
    return normalizePublishPreferences(JSON.parse(raw));
  } catch {
    return defaultPublishPreferences;
  }
}

export function writePublishPreferences(preferences: PublishPreferences) {
  if (typeof window === "undefined") {
    return;
  }

  const normalized = normalizePublishPreferences(preferences);
  window.localStorage.setItem(
    PUBLISH_PREFERENCES_KEY,
    JSON.stringify(normalized),
  );
  window.dispatchEvent(
    new CustomEvent(PUBLISH_PREFERENCES_EVENT, { detail: normalized }),
  );
}

export function normalizePublishPreferences(value: unknown): PublishPreferences {
  const preferences = value as Partial<PublishPreferences> | null;

  return {
    fediverse: {
      comment: Boolean(preferences?.fediverse?.comment),
      mark: false,
      review: Boolean(preferences?.fediverse?.review),
    },
    visibility: {
      mark: normalizeNeodbVisibility(preferences?.visibility?.mark),
      review: normalizeNeodbVisibility(preferences?.visibility?.review),
    },
  };
}
