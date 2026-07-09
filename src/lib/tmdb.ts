import { type NeodbItem } from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { type Locale } from "@/i18n/config";

export type TmdbMovieResult = {
  id?: number;
};

export type TmdbMediaDetails = {
  poster_path?: string | null;
};

export type TmdbMediaType = "movie" | "tv";

export type TmdbCastMember = {
  character?: string;
  id?: number;
  name?: string;
  order?: number;
  profile_path?: string | null;
};

export type TmdbCrewMember = {
  department?: string;
  id?: number;
  job?: string;
  name?: string;
  profile_path?: string | null;
};

type TmdbCredentials = {
  accessToken?: string;
  apiKey?: string;
};

export function getTmdbCredentials(): TmdbCredentials | null {
  const apiKey = process.env.TMDB_API_KEY?.trim();
  const accessToken = process.env.TMDB_ACCESS_TOKEN?.trim();

  if (!apiKey && !accessToken) {
    return null;
  }

  return { accessToken, apiKey };
}

export async function getTmdbMovieIdForItem(item: NeodbItem) {
  return getTmdbMediaIdForItem(item, "movie");
}

export async function getTmdbMediaIdForItem(
  item: NeodbItem,
  mediaType: TmdbMediaType,
) {
  const credentials = getTmdbCredentials();

  if (!credentials) {
    return null;
  }

  return (
    findTmdbMediaId(item.external_resources, mediaType) ||
    (item.imdb
      ? await findTmdbMediaIdByImdb(item.imdb, mediaType, credentials)
      : null)
  );
}

export async function fetchTmdbJson<T>(
  url: string,
  credentials: TmdbCredentials,
  language = "zh-CN",
  extraParams?: Record<string, string>,
  timeoutMs = 8_000,
) {
  configureServerFetchProxy();

  const requestUrl = new URL(url);

  if (credentials.apiKey) {
    requestUrl.searchParams.set("api_key", credentials.apiKey);
  }

  requestUrl.searchParams.set("language", language);

  for (const [key, value] of Object.entries(extraParams || {})) {
    requestUrl.searchParams.set(key, value);
  }

  const response = await fetchWithTimeout(
    requestUrl.toString(),
    {
      headers: {
        Accept: "application/json",
        ...(credentials.accessToken
          ? { Authorization: `Bearer ${credentials.accessToken}` }
          : {}),
      },
      next: { revalidate: 60 * 60 * 24 },
    },
    timeoutMs,
  );

  if (!response.ok) {
    throw new Error(`tmdb_failed_${response.status}`);
  }

  return (await response.json()) as T;
}

export function getTmdbLanguage(locale: Locale) {
  const languageMap: Record<Locale, string> = {
    en: "en-US",
    "zh-Hans": "zh-CN",
    "zh-Hant": "zh-TW",
  };

  return languageMap[locale];
}

export function getTmdbProfileUrl(path?: string | null, size = "w185") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function getTmdbPosterUrl(path?: string | null, size = "w342") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export function getTmdbBackdropUrl(path?: string | null, size = "w1280") {
  return path ? `https://image.tmdb.org/t/p/${size}${path}` : null;
}

export type TmdbStillImage = {
  height?: number;
  url: string;
  width?: number;
};

export async function getTmdbStills(
  item: NeodbItem,
  mediaType: TmdbMediaType,
): Promise<TmdbStillImage[] | null> {
  const credentials = getTmdbCredentials();

  if (!credentials) {
    return null;
  }

  const tmdbId = await getTmdbMediaIdForItem(item, mediaType);

  if (!tmdbId) {
    return null;
  }

  try {
    const payload = await fetchTmdbJson<{
      backdrops?: Array<{
        file_path?: string;
        height?: number;
        width?: number;
      }>;
    }>(
      `https://api.themoviedb.org/3/${mediaType}/${tmdbId}/images`,
      credentials,
      undefined,
      { include_image_language: "null,zh,en" },
    );

    const images = (payload.backdrops || [])
      .filter((backdrop) => Boolean(backdrop.file_path))
      .map((backdrop) => ({
        height: backdrop.height,
        url: getTmdbBackdropUrl(backdrop.file_path) as string,
        width: backdrop.width,
      }));

    return images.length > 0 ? images : null;
  } catch {
    return null;
  }
}

function findTmdbMediaId(
  resources: Array<{ url?: string }> | null | undefined,
  mediaType: TmdbMediaType,
) {
  for (const resource of resources || []) {
    const value = resource.url || "";

    try {
      const url = new URL(value);
      const isTmdb =
        url.hostname === "tmdb.org" ||
        url.hostname === "www.tmdb.org" ||
        url.hostname === "themoviedb.org" ||
        url.hostname === "www.themoviedb.org";

      if (!isTmdb) {
        continue;
      }

      const segments = url.pathname.split("/").filter(Boolean);
      const mediaIndex = segments.findIndex((segment) => segment === mediaType);
      const idSegment = mediaIndex >= 0 ? segments[mediaIndex + 1] : null;
      const id = idSegment?.match(/^\d+/)?.[0];

      if (id) {
        return Number(id);
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function findTmdbMediaIdByImdb(
  imdb: string,
  mediaType: TmdbMediaType,
  credentials: TmdbCredentials,
) {
  const imdbId = imdb.match(/tt\d+/)?.[0];

  if (!imdbId) {
    return null;
  }

  try {
    const payload = await fetchTmdbJson<{
      movie_results?: TmdbMovieResult[];
      tv_results?: TmdbMovieResult[];
    }>(
      `https://api.themoviedb.org/3/find/${imdbId}?external_source=imdb_id`,
      credentials,
    );

    return mediaType === "movie"
      ? payload.movie_results?.[0]?.id || null
      : payload.tv_results?.[0]?.id || null;
  } catch {
    return null;
  }
}
