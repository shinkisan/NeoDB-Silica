import Image from "next/image";
import { cookies } from "next/headers";
import {
  CollectionScrollRestorer,
  CollectionScrollTop,
  CollectionTopBar,
} from "./collection-chrome";
import {
  CollectionContentFrame,
  CollectionIntroFrame,
  CollectionPageLabel,
} from "./collection-content-frame";
import { CollectionItemLink } from "./collection-item-link";
import { CollectionItemActions } from "./collection-item-actions";
import { CollectionPagination } from "./collection-pagination";
import { CollectionBriefEditor } from "./collection-brief-editor";
import {
  RatingBadge,
  StatusBadge,
  type ShelfType,
} from "@/components/mark-badges";
import {
  buildCollectionCacheScope,
  clearCollectionPageCache,
  getCollectionPageCache,
  setCollectionPageCache,
  type CachedCollectionPage,
} from "@/lib/collection-page-cache";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  getNeodbBaseUrl,
  normalizeNeodbItem,
  type NeodbCollection,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { getT } from "@/i18n/server";

type CollectionPageProps = {
  params: Promise<{
    uuid: string;
  }>;
  searchParams: Promise<{
    cache?: string;
    page?: string;
  }>;
};

type CollectionItem = {
  item: NeodbItem;
  note?: string;
};

type CollectionMark = {
  item: {
    uuid: string;
  };
  shelf_type: ShelfType;
};

type PagedCollectionItems = {
  count: number;
  data: CollectionItem[];
  pages: number;
};

const COLLECTION_PAGE_SIZE = 20;

export default async function CollectionPage({
  params,
  searchParams,
}: CollectionPageProps) {
  const { uuid } = await params;
  const query = await searchParams;
  const parsedPage = Number(query.page || 1);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const useCache = query.cache === "1";
  const t = await getT();
  const result = await fetchCollectionPage(uuid, page, useCache);

  if (result.status === "error") {
    return (
      <>
        <CollectionTopBar showActions={false} title={t("collection.title")} uuid={uuid} />
        <CollectionScrollTop uuid={uuid} />
        <div aria-hidden="true" className="h-16" />
        <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-6 text-[var(--foreground)]">
          <div className="mx-auto max-w-2xl rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-900">
            <p>{t("collection.loadError")}</p>
            {result.loginRequired ? (
              <p className="mt-2">{t("collection.loginRequired")}</p>
            ) : null}
          </div>
        </main>
      </>
    );
  }

  const { baseUrl, collection, items } = result;
  const title = collection.title || t("collection.title");
  const description = collection.brief || stripHtml(collection.html_content || "");
  const total = items.count || getCollectionTotal(collection);
  const canEditCollection = await isOwnCollection(uuid);
  const markMap = await fetchCollectionMarks(
    items.data.map((entry) => entry.item.uuid).filter(Boolean),
  );

  return (
    <>
      <CollectionTopBar
        neodbUrl={toAbsoluteUrl(collection.url, baseUrl)}
        title={title}
        uuid={uuid}
      />
      <CollectionScrollTop uuid={uuid} />
      <CollectionScrollRestorer page={page} uuid={uuid} />
      <div aria-hidden="true" className="h-16" />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-6 text-[var(--foreground)]"
        data-collection-page
      >
        <div className="mx-auto max-w-2xl space-y-6 lg:max-w-4xl">
          {page === 1 ? (
            <CollectionIntroFrame>
              <section className="min-w-0 space-y-3">
                <h1 className="break-words text-[1.8rem] font-semibold leading-tight text-[var(--foreground)]">
                  {title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  {collection.is_dynamic ? (
                    <span className="rounded-full border border-[#bcc7dd]/80 bg-[#dde3eb]/70 px-3 py-1 text-xs font-bold text-[#333e50]">
                      {t("collection.dynamic")}
                    </span>
                  ) : null}
                </div>
                <CollectionBriefEditor
                  canEdit={canEditCollection}
                  description={description}
                  uuid={uuid}
                />
              </section>
            </CollectionIntroFrame>
          ) : null}

          <CollectionPageLabel
            currentPage={page}
            label={t("collection.pageLabel")}
            pages={items.pages}
            totalLabel={t("collection.itemCount").replace(
              "{count}",
              String(total),
            )}
          />

          <CollectionContentFrame key={`${uuid}:${page}`}>
            <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {items.data.map((entry, index) => {
                const item = normalizeNeodbItem(entry.item, baseUrl);
                const href = `${item.detailPath}?fromCategory=collection`;
                const mark = markMap.get(item.id);

                return (
                  <article
                    className="relative rounded-2xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5 transition hover:bg-white/75 active:scale-[0.99]"
                    key={`${item.id}-${index}`}
                  >
                    {canEditCollection ? (
                      <CollectionItemActions
                        itemTitle={item.title}
                        itemUuid={item.id}
                        uuid={uuid}
                      />
                    ) : null}
                    <CollectionItemLink href={href} page={page} uuid={uuid}>
                      <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 pr-8 sm:grid-cols-[7rem_minmax(0,1fr)]">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#e2e2e5]">
                          {item.coverUrl ? (
                            <Image
                              alt={item.title}
                              className="h-full w-full object-cover"
                              fill
                              loading={index < 8 ? "eager" : "lazy"}
                              quality={75}
                              sizes="(max-width: 640px) 96px, 112px"
                              src={item.coverUrl}
                              unoptimized={process.env.NODE_ENV !== "production"}
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-[#75777d]">
                              {item.title}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 py-1">
                          <h2 className="line-clamp-2 text-lg font-bold leading-snug text-[var(--foreground)]">
                            {item.title}
                          </h2>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-[#c5c6cd]/70 bg-white/70 px-2.5 py-1 text-xs font-bold text-[#44474c]">
                              {getLocalizedCategoryLabel(
                                t,
                                item.category,
                                item.categoryLabel,
                              )}
                            </span>
                            <RatingBadge value={item.rating} />
                            {mark ? (
                              <StatusBadge
                                category={item.category}
                                status={mark.shelf_type}
                              />
                            ) : null}
                          </div>
                          {item.creator ? (
                            <p className="mt-2 truncate text-sm font-semibold text-[#75777d]">
                              {item.creator}
                            </p>
                          ) : null}
                          {entry.note ? (
                            <p className="mt-2 line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#44474c]">
                              {entry.note}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </CollectionItemLink>
                  </article>
                );
              })}
            </section>
          </CollectionContentFrame>

          <CollectionPagination
            currentPage={page}
            pages={items.pages}
            uuid={uuid}
          />
        </div>
      </main>
    </>
  );
}

async function fetchCollectionPage(
  uuid: string,
  page: number,
  useCache: boolean,
): Promise<CachedCollectionPage | { loginRequired: boolean; status: "error" }> {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const baseUrl = session?.instance || getNeodbBaseUrl();
  const authHeaders: Record<string, string> = session?.accessToken
    ? {
        Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
      }
    : {};
  const cacheScope = buildCollectionCacheScope({
    accessToken: session?.accessToken,
    baseUrl,
    uuid,
  });

  if (!useCache) {
    clearCollectionPageCache(cacheScope);
  }

  const cached = useCache ? getCollectionPageCache(cacheScope, page) : undefined;

  if (cached) {
    return cached;
  }

  configureServerFetchProxy();

  try {
    const [collectionResponse, itemsResponse] = await Promise.all([
      fetchWithTimeout(
        `${baseUrl}/api/collection/${encodeURIComponent(uuid)}`,
        {
          headers: { Accept: "application/json", ...authHeaders },
          ...(session?.accessToken
            ? { cache: "no-store" as const }
            : { next: { revalidate: 60 * 30 } }),
        },
        8_000,
      ),
      fetchWithTimeout(
        `${baseUrl}/api/collection/${encodeURIComponent(uuid)}/item/?page=${page}&page_size=${COLLECTION_PAGE_SIZE}`,
        {
          headers: { Accept: "application/json", ...authHeaders },
          ...(session?.accessToken
            ? { cache: "no-store" as const }
            : { next: { revalidate: 60 * 30 } }),
        },
        8_000,
      ),
    ]);

    if (!collectionResponse.ok || !itemsResponse.ok) {
      return { loginRequired: !session?.accessToken, status: "error" };
    }

    const payload: CachedCollectionPage = {
      baseUrl,
      collection: (await collectionResponse.json()) as NeodbCollection,
      items: normalizePagedItems(
        (await itemsResponse.json()) as PagedCollectionItems,
      ),
      status: "ok",
    };

    setCollectionPageCache(cacheScope, page, payload);

    return payload;
  } catch {
    return { loginRequired: !session?.accessToken, status: "error" };
  }
}

async function fetchCollectionMarks(itemUuids: string[]) {
  const markMap = new Map<string, CollectionMark>();
  const uniqueItemUuids = Array.from(new Set(itemUuids)).slice(0, COLLECTION_PAGE_SIZE);

  if (!uniqueItemUuids.length) {
    return markMap;
  }

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return markMap;
  }

  configureServerFetchProxy();

  for (let index = 0; index < uniqueItemUuids.length; index += 20) {
    const chunk = uniqueItemUuids.slice(index, index + 20);

    try {
      const response = await fetchWithTimeout(
        `${session.instance}/api/me/shelf/items/${encodeURIComponent(chunk.join(","))}`,
        {
          cache: "no-store",
          headers: {
            Accept: "application/json",
            Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
          },
        },
        8_000,
      );

      if (!response.ok) {
        continue;
      }

      const marks = (await response.json()) as CollectionMark[];

      for (const mark of marks) {
        if (mark?.item?.uuid && mark.shelf_type) {
          markMap.set(mark.item.uuid, mark);
        }
      }
    } catch {
      // Mark badges are opportunistic; keep the collection readable if this fails.
    }
  }

  return markMap;
}

async function isOwnCollection(uuid: string) {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return false;
  }

  configureServerFetchProxy();

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/collection/${encodeURIComponent(uuid)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      5_000,
    );

    return response.ok;
  } catch {
    return false;
  }
}

function normalizePagedItems(payload: PagedCollectionItems): PagedCollectionItems {
  const data = Array.isArray(payload.data) ? payload.data : [];
  const count = Number.isFinite(payload.count) ? payload.count : data.length;
  const fallbackPages = count > 0 ? Math.ceil(count / COLLECTION_PAGE_SIZE) : 0;

  return {
    count,
    data: data.filter((entry) => entry?.item),
    pages: Math.max(
      0,
      Number.isFinite(payload.pages) ? payload.pages : fallbackPages,
    ),
  };
}

function getCollectionTotal(
  collection: NeodbCollection & { item_count_by_category?: Record<string, number> },
) {
  const counts = collection.item_count_by_category;

  if (!counts) {
    return 0;
  }

  return Object.entries(counts)
    .filter(([key]) => key !== "collection" && key !== "people")
    .reduce((sum, [, value]) => sum + (Number.isFinite(value) ? value : 0), 0);
}

function getLocalizedCategoryLabel(
  t: (key: string) => string,
  category: string,
  fallback: string,
) {
  const key =
    category === "movie,tv" ? "category.movieTv" : `category.${category}`;
  const label = t(key);

  return label === key ? fallback : label;
}

function stripHtml(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (/^https?:\/\//.test(value)) {
    return value;
  }

  return `${baseUrl}${value.startsWith("/") ? value : `/${value}`}`;
}
