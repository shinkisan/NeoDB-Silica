import { getConfiguredNeodbInstance } from "@/lib/neodb-instance";

export const NEODB_CATEGORIES = [
  "book",
  "movie",
  "tv",
  "music",
  "game",
  "podcast",
  "performance",
] as const;

export const SEARCH_CATEGORIES = [
  "book",
  "movie",
  "tv",
  "movie,tv",
  "music",
  "game",
  "podcast",
  "performance",
] as const;

export type NeodbCategory = (typeof NEODB_CATEGORIES)[number];
export type SearchCategory = (typeof SEARCH_CATEGORIES)[number];

export type NeodbItem = {
  uuid: string;
  id?: string;
  url: string;
  api_url?: string;
  category: NeodbCategory | string;
  type?: string;
  title?: string;
  display_title: string;
  cover_image_url: string | null;
  rating: number | null;
  rating_count: number | null;
  rating_distribution?: number[] | null;
  tags: string[] | null;
  description?: string;
  brief?: string;
  external_resources?: Array<{
    url?: string;
  }> | null;
  imdb?: string | null;
  isbn?: string | null;
  pages?: number | null;
  credits?: Array<{
    character_name?: string;
    role?: string;
    name?: string;
    person_url?: string | null;
  }>;
};

export type NeodbCollection = {
  api_url?: string;
  brief?: string;
  cover?: string;
  cover_image_url?: string | null;
  html_content?: string;
  is_dynamic?: boolean;
  query?: string | null;
  title: string;
  url: string;
  uuid: string;
};

export type HomeItem = {
  id: string;
  title: string;
  href: string;
  detailPath: string;
  apiPath: string | null;
  category: string;
  categoryLabel: string;
  coverUrl: string | null;
  rating: number | null;
  ratingCount: number | null;
  tags: string[];
  creator: string | null;
  description: string;
  isbn?: string | null;
  kind?: "item" | "collection";
  pages?: number | null;
};

const categoryLabels: Record<string, string> = {
  book: "图书",
  movie: "电影",
  tv: "剧集",
  "tv-season": "剧集",
  "tv-episode": "剧集",
  music: "音乐",
  game: "游戏",
  podcast: "播客",
  "podcast-episode": "播客",
  performance: "演出",
  "performance-production": "演出",
};

export function getNeodbBaseUrl() {
  return getConfiguredNeodbInstance();
}

export function isNeodbCategory(value: string): value is NeodbCategory {
  return NEODB_CATEGORIES.includes(value as NeodbCategory);
}

export function isSearchCategory(value: string): value is SearchCategory {
  return SEARCH_CATEGORIES.includes(value as SearchCategory);
}

export function normalizeNeodbItem(item: NeodbItem, baseUrl: string): HomeItem {
  const href = item.url?.startsWith("http")
    ? item.url
    : `${baseUrl}${item.url || ""}`;
  const itemId = item.uuid || item.id || href;
  const creator =
    item.credits?.find((credit) => credit.role === "author")?.name ||
    item.credits?.find((credit) => credit.role === "director")?.name ||
    item.credits?.find((credit) => credit.role === "artist")?.name ||
    item.credits?.find((credit) => credit.name)?.name ||
    null;

  return {
    id: itemId,
    title: item.display_title || item.title || "Untitled",
    href,
    detailPath: `/item/${item.category}/${encodeURIComponent(itemId)}`,
    apiPath: item.api_url || null,
    category: item.category,
    categoryLabel: categoryLabels[item.category] || item.category,
    coverUrl: item.cover_image_url,
    rating: item.rating,
    ratingCount: item.rating_count,
    tags: (item.tags || []).slice(0, 3),
    creator,
    description: item.description || item.brief || "",
    isbn: item.isbn || null,
    kind: "item",
    pages: Number.isFinite(item.pages) ? item.pages : null,
  };
}

export function normalizeNeodbCollection(
  collection: NeodbCollection,
  baseUrl: string,
): HomeItem {
  const href = resolveNeodbUrl(collection.url, baseUrl);
  const collectionId = collection.uuid || href;
  const coverUrl = collection.cover_image_url || collection.cover || null;

  return {
    id: collectionId,
    title: collection.title || "Untitled",
    href,
    detailPath: `/collection/${encodeURIComponent(collectionId)}`,
    apiPath: collection.api_url ? resolveNeodbUrl(collection.api_url, baseUrl) : null,
    category: "collection",
    categoryLabel: "收藏单",
    coverUrl: coverUrl ? resolveNeodbUrl(coverUrl, baseUrl) : null,
    rating: null,
    ratingCount: null,
    tags: [],
    creator: "收藏单",
    description: collection.brief || collection.html_content || "",
    kind: "collection",
  };
}

function resolveNeodbUrl(value: string, baseUrl: string) {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}

const categoryApiPaths: Record<string, string> = {
  music: "album",
  "tv-season": "tv/season",
  "tv-episode": "tv/episode",
  "podcast-episode": "podcast/episode",
  "performance-production": "performance/production",
};

const apiPathToCategory: Record<string, string> = Object.fromEntries(
  Object.entries(categoryApiPaths).map(([category, apiPath]) => [apiPath, category]),
);

export function getItemApiPath(category: string, uuid: string) {
  const normalizedCategory = categoryApiPaths[category] || category;
  return `/api/${normalizedCategory}/${uuid}`;
}

const itemTypeToCategory: Record<string, string> = {
  TVSeason: "tv-season",
  TVEpisode: "tv-episode",
  PodcastEpisode: "podcast-episode",
  PerformanceProduction: "performance-production",
};

/**
 * NeoDB's item API is lenient about the requested category segment: e.g.
 * fetching a season uuid via `/api/tv/{uuid}` (the parent show's path)
 * returns the season's full data anyway rather than 404ing, because both
 * share the broad "tv" category. The returned item's own `type` field is the
 * reliable signal for a uuid that actually belongs to a narrower category
 * than the one requested (e.g. `type: "TVSeason"` when `category` was `"tv"`).
 */
export function resolveCategoryFromItemType(type: string | null | undefined) {
  return (type && itemTypeToCategory[type]) || null;
}

/**
 * Reverses `getItemApiPath`: given an item API path (as returned e.g. by
 * NeoDB's "Item recasted" response when a uuid's category/identity changed),
 * resolves the app's own `/item/{category}/...` category segment.
 */
export function resolveCategoryFromApiPath(apiPath: string): string | null {
  let pathname = apiPath;

  if (/^https?:\/\//.test(apiPath)) {
    try {
      pathname = new URL(apiPath).pathname;
    } catch {
      return null;
    }
  }

  const segments = pathname
    .replace(/^\/?api\//, "")
    .replace(/\/$/, "")
    .split("/")
    .filter(Boolean);

  if (segments.length < 2) {
    return null;
  }

  const apiCategory = segments.slice(0, -1).join("/");

  return apiPathToCategory[apiCategory] || apiCategory;
}
