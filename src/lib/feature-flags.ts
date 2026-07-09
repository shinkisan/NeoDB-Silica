import { getTmdbCredentials } from "@/lib/tmdb";

/**
 * Optional integrations that a deployment may or may not have configured.
 * Computed on the server from environment variables and surfaced to the client
 * via `FeatureFlagsProvider` so UI entry points can be hidden entirely when the
 * backing service is not available (rather than failing on use).
 */
export type FeatureFlags = {
  /** TMDB enrichment (high-res posters, stills, cast links, discovery rails). */
  tmdb: boolean;
  /** Azure Translator-backed comment/activity translation. */
  translate: boolean;
};

export function isTmdbConfigured(): boolean {
  return getTmdbCredentials() !== null;
}

export function isTranslateConfigured(): boolean {
  const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT?.trim();

  return Boolean(key && endpoint);
}

export function getServerFeatureFlags(): FeatureFlags {
  return {
    tmdb: isTmdbConfigured(),
    translate: isTranslateConfigured(),
  };
}
