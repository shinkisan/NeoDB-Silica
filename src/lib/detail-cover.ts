import { type Locale } from "@/i18n/config";
import { type NeodbItem } from "@/lib/neodb";
import {
  fetchTmdbJson,
  getTmdbCredentials,
  getTmdbMediaIdForItem,
  getTmdbPosterUrl,
  type TmdbMediaDetails,
} from "@/lib/tmdb";
import {
  getDefaultTmdbRegion,
  getTmdbLanguageForRegion,
  getTmdbPosterLanguagePreferences,
  type TmdbRegion,
} from "@/lib/tmdb-regions";

const DETAIL_COVER_TMDB_TIMEOUT_MS = 3_000;

type DetailCoverOptions = {
  locale: Locale;
  tmdbRegion?: TmdbRegion | null;
};

type TmdbPosterImage = {
  file_path?: string;
  height?: number;
  iso_639_1?: string | null;
  vote_average?: number;
  vote_count?: number;
  width?: number;
};

type DetailCoverItem = NeodbItem & { season_number?: number | null };

export async function getEnhancedDetailCoverUrl(
  item: DetailCoverItem,
  options: DetailCoverOptions,
) {
  return (await getTmdbDetailPosterUrl(item, options)) || item.cover_image_url;
}

async function getTmdbDetailPosterUrl(
  item: DetailCoverItem,
  { locale, tmdbRegion }: DetailCoverOptions,
) {
  const credentials = getTmdbCredentials();

  if (!credentials) {
    return null;
  }

  const mediaType =
    item.category === "movie" ? "movie" : item.category === "tv" ? "tv" : null;

  if (!mediaType) {
    return null;
  }

  const tmdbId = await getTmdbMediaIdForItem(item, mediaType);

  if (!tmdbId) {
    return null;
  }

  // NeoDB's own `category` field is "tv" for both a show and a season (the
  // "tv-season" segment only exists in this app's own routing), so a season
  // is only distinguishable here by having its own `season_number`. A
  // season's poster lives under the show's tv/{id}/season/{n} path, not
  // tv/{id} (which only has the show's own general poster).
  const basePath = typeof item.season_number === "number"
    ? `tv/${tmdbId}/season/${item.season_number}`
    : `${mediaType}/${tmdbId}`;

  const region = tmdbRegion || getDefaultTmdbRegion(locale);
  const language = getTmdbLanguageForRegion(region);
  const posterLanguages = getTmdbPosterLanguagePreferences(region);

  try {
    const images = await fetchTmdbJson<{ posters?: TmdbPosterImage[] }>(
      `https://api.themoviedb.org/3/${basePath}/images`,
      credentials,
      language,
      { include_image_language: posterLanguages.join(",") },
      DETAIL_COVER_TMDB_TIMEOUT_MS,
    );
    const poster = choosePoster(images.posters || [], posterLanguages);

    if (poster?.file_path) {
      return getTmdbPosterUrl(poster.file_path, "original");
    }
  } catch {
    // Fall back to the localized detail poster below.
  }

  try {
    const details = await fetchTmdbJson<TmdbMediaDetails>(
      `https://api.themoviedb.org/3/${basePath}`,
      credentials,
      language,
      undefined,
      DETAIL_COVER_TMDB_TIMEOUT_MS,
    );

    return getTmdbPosterUrl(details.poster_path, "original");
  } catch {
    return null;
  }
}

function choosePoster(
  posters: TmdbPosterImage[],
  languagePreferences: string[],
) {
  const languageRank = new Map(
    languagePreferences.map((language, index) => [language, index]),
  );

  return [...posters]
    .filter((poster) => Boolean(poster.file_path))
    .sort((a, b) => {
      const aLanguage = a.iso_639_1 || "null";
      const bLanguage = b.iso_639_1 || "null";
      const aRank = languageRank.get(aLanguage) ?? languagePreferences.length;
      const bRank = languageRank.get(bLanguage) ?? languagePreferences.length;

      if (aRank !== bRank) {
        return aRank - bRank;
      }

      const voteCountDelta = (b.vote_count || 0) - (a.vote_count || 0);

      if (voteCountDelta !== 0) {
        return voteCountDelta;
      }

      const voteAverageDelta = (b.vote_average || 0) - (a.vote_average || 0);

      if (voteAverageDelta !== 0) {
        return voteAverageDelta;
      }

      return getPosterPixels(b) - getPosterPixels(a);
    })[0];
}

function getPosterPixels(poster: TmdbPosterImage) {
  return (poster.width || 0) * (poster.height || 0);
}
