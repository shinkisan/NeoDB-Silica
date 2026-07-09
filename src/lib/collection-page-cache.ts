import type { NeodbCollection, NeodbItem } from "@/lib/neodb";

export type CollectionCacheItem = {
  item: NeodbItem;
  note?: string;
};

export type CachedCollectionPage = {
  baseUrl: string;
  collection: NeodbCollection & {
    item_count_by_category?: Record<string, number>;
  };
  items: {
    count: number;
    data: CollectionCacheItem[];
    pages: number;
  };
  status: "ok";
};

type CacheEntry = {
  expiresAt: number;
  value: CachedCollectionPage;
};

const COLLECTION_PAGE_CACHE_TTL = 1000 * 60 * 10;
const collectionPageCache = new Map<string, CacheEntry>();

export function buildCollectionCacheScope({
  accessToken,
  baseUrl,
  uuid,
}: {
  accessToken?: string;
  baseUrl: string;
  uuid: string;
}) {
  return [
    baseUrl,
    accessToken || "public",
    "collection",
    uuid,
  ].join(":");
}

export function getCollectionPageCache(scope: string, page: number) {
  const key = getCollectionPageCacheKey(scope, page);
  const entry = collectionPageCache.get(key);

  if (!entry) {
    return undefined;
  }

  if (entry.expiresAt < Date.now()) {
    collectionPageCache.delete(key);
    return undefined;
  }

  return entry.value;
}

export function setCollectionPageCache(
  scope: string,
  page: number,
  value: CachedCollectionPage,
) {
  collectionPageCache.set(getCollectionPageCacheKey(scope, page), {
    expiresAt: Date.now() + COLLECTION_PAGE_CACHE_TTL,
    value,
  });
}

export function clearCollectionPageCache(scope: string) {
  for (const key of collectionPageCache.keys()) {
    if (key.startsWith(`${scope}:`)) {
      collectionPageCache.delete(key);
    }
  }
}

function getCollectionPageCacheKey(scope: string, page: number) {
  return `${scope}:page:${page}`;
}
