import type { HomeItem, NeodbItem } from "@/lib/neodb";
import { fetchWithTimeout, type ServerFetchInit } from "@/lib/server-fetch";

type PagedCollectionItems = {
  data?: Array<NeodbItem | { item?: NeodbItem | null }>;
};

type CollectionFallbackCoverOptions = {
  baseUrl: string;
  fetchInit?: ServerFetchInit;
  locale?: string;
};

export async function applyCollectionFallbackCover(
  collection: HomeItem,
  { baseUrl, fetchInit, locale = "default" }: CollectionFallbackCoverOptions,
): Promise<HomeItem> {
  if (!needsCollectionFallbackCover(collection.coverUrl)) {
    return collection;
  }

  const fallbackCoverUrl = await fetchFirstCollectionItemCover(collection.id, {
    baseUrl,
    fetchInit,
    locale,
  });

  return fallbackCoverUrl
    ? { ...collection, coverUrl: fallbackCoverUrl }
    : collection;
}

export function needsCollectionFallbackCover(coverUrl: string | null | undefined) {
  if (!coverUrl) {
    return true;
  }

  try {
    return new URL(coverUrl).pathname === "/m/item/default.svg";
  } catch {
    return false;
  }
}

async function fetchFirstCollectionItemCover(
  collectionUuid: string,
  { baseUrl, fetchInit, locale }: CollectionFallbackCoverOptions & { locale: string },
) {
  try {
    const url = new URL(
      `${baseUrl}/api/collection/${encodeURIComponent(collectionUuid)}/item/`,
    );
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "1");
    url.searchParams.set("_locale", locale);

    const response = await fetchWithTimeout(url, fetchInit || {}, 3_500);

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as PagedCollectionItems | NeodbItem[];
    const firstEntry = Array.isArray(payload) ? payload[0] : payload.data?.[0];
    const firstItem = getCollectionEntryItem(firstEntry);
    const coverUrl = firstItem?.cover_image_url;

    return coverUrl ? resolveUrl(coverUrl, baseUrl) : null;
  } catch {
    return null;
  }
}

function getCollectionEntryItem(
  entry: NeodbItem | { item?: NeodbItem | null } | undefined,
) {
  if (!entry) {
    return null;
  }

  if ("cover_image_url" in entry) {
    return entry;
  }

  return entry.item || null;
}

function resolveUrl(value: string, baseUrl: string) {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
