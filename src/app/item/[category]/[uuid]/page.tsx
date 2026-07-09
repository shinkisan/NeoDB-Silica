import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { CommunityList, CommunityLoadingSkeleton } from "./community-list";
import {
  DetailReviewActions,
  ShortReviewFloatingButton,
  DetailTopBar,
  type DetailInitialMark,
} from "./detail-chrome";
import {
  DetailBackToTop,
  DetailPageExitReset,
  DetailScrollRestorer,
} from "./detail-scroll-controls";
import { ImageViewer } from "./image-viewer";
import { RatingDistributionBadge } from "./rating-distribution-badge";
import { DetailHashtags } from "./detail-hashtags";
import { SeasonDropdown, type SeasonOption } from "./season-dropdown";
import {
  getCategoryLabel,
  getDetailHashtags,
  getDetailMeta,
  MetaBadge,
} from "./detail-meta";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  resolveCategoryFromApiPath,
  resolveCategoryFromItemType,
  type NeodbItem,
} from "@/lib/neodb";
import { getEnhancedDetailCoverUrl } from "@/lib/detail-cover";
import { getTmdbStills, type TmdbMediaType } from "@/lib/tmdb";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { emptyMarkSnapshot, fetchShelfMarkSnapshot } from "@/lib/neodb-mark";
import { getCommunityCommentPage, getCommunityOwnEntries } from "@/lib/community";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import {
  getDefaultTmdbRegion,
  isTmdbRegion,
  TMDB_REGION_COOKIE,
} from "@/lib/tmdb-regions";
import { getLocale, getT } from "@/i18n/server";

type DetailPageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
};

type DetailItem = NeodbItem & {
  subtitle?: string | null;
  orig_title?: string | null;
  language?: string[];
  pub_house?: string[];
  pub_year?: string | null;
  pub_month?: string | null;
  release_date?: string | null;
  opening_date?: string | null;
  year?: number | string | null;
  duration?: number | string | null;
  runtime?: number | string | null;
  genre?: string[] | string | null;
  genres?: string[] | string | null;
  director?: string[];
  creator?: string[];
  author?: string[];
  translator?: string[] | string | null;
  artist?: string[];
  company?: string[];
  developer?: string[] | string | null;
  publisher?: string[] | string | null;
  track_list?: string | null;
  isbn?: string | null;
  official_site?: string | null;
  parent_uuid?: string | null;
  season_number?: number | null;
  season_uuids?: string[] | null;
};

type DetailItemResult =
  | { item: DetailItem; status: "found" }
  | { item: null; status: "not-found" | "unavailable" };

export default async function DetailPage({ params }: DetailPageProps) {
  const { category, uuid } = await params;
  const t = await getT();
  const locale = await getLocale();
  const [itemResult, initialMark] = await Promise.all([
    fetchItem(category, uuid),
    fetchInitialMark(uuid),
  ]);

  if (itemResult.status === "found") {
    const item = itemResult.item;
    const meta = getDetailMeta(item, t);
    const description = item.description || item.brief || t("detail.noDescription");
    const tmdbRegion = await getDetailTmdbRegion(locale);
    const [displayCoverUrl, stills, seasonOptions] = await Promise.all([
      getEnhancedDetailCoverUrl(item, { locale, tmdbRegion }),
      fetchTmdbStills(item),
      fetchSeasonOptions(category, item, t),
    ]);

    return (
      <>
        <DetailTopBar
          category={item.category}
          coverUrl={displayCoverUrl}
          externalResources={[
            ...(item.external_resources || []),
            ...(item.official_site
              ? [{ kind: "official_site" as const, url: item.official_site }]
              : []),
          ]}
          itemUuid={item.uuid}
          isbn={item.isbn || null}
          neodbUrl={item.url ? toAbsoluteUrl(item.url) : null}
          title={item.display_title || item.title || t("detail.fallbackTitle")}
          trackList={item.track_list || null}
        />
        <div aria-hidden="true" className="h-16" />
        <DetailScrollRestorer itemUuid={item.uuid} />
        <DetailPageExitReset itemUuid={item.uuid} />
        <main
          className="detail-page-enter min-h-dvh scroll-pt-20 bg-[var(--background)] px-5 pb-20 pt-5 text-[var(--foreground)]"
          data-detail-page
        >
          <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
            <section className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)] gap-5 [@media(orientation:landscape)]:grid-cols-[minmax(0,46%)_minmax(0,1fr)] [@media(orientation:landscape)]:items-start">
              <div className="z-10 aspect-[4/5] w-full min-w-0 max-w-full transform-gpu rounded-2xl [backface-visibility:hidden] [@media(orientation:landscape)]:sticky [@media(orientation:landscape)]:top-[84px] [@media(orientation:landscape)]:aspect-[3/4]">
                <div className="relative h-full overflow-hidden rounded-2xl bg-[var(--background)] shadow-[0_8px_30px_rgb(74,85,104,0.12)]">
                  {displayCoverUrl ? (
                    <ImageViewer
                      alt={item.display_title || item.title || "作品封面"}
                      src={displayCoverUrl}
                      stills={stills}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center p-8 text-center text-lg font-semibold text-[#75777d]">
                      {item.display_title || item.title}
                    </div>
                  )}
                </div>
              </div>

              <div className="min-w-0 max-w-full space-y-4">
                <div className="min-w-0">
                  <div className="mb-2 flex min-w-0 flex-wrap items-center gap-1.5 text-sm font-semibold text-[#75777d]">
                    <span>{getCategoryLabel(item.category, t)}</span>
                    {seasonOptions.length > 1 ? (
                      <SeasonDropdown
                        currentUuid={category === "tv-season" ? item.uuid : null}
                        itemUuid={item.uuid}
                        options={seasonOptions}
                        triggerLabel={
                          category === "tv-season" &&
                          typeof item.season_number === "number"
                            ? formatSeasonLabel(item.season_number, t)
                            : t("detail.seasons.select")
                        }
                      />
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-wrap items-center gap-3">
                    <h1 className="min-w-0 max-w-full break-words text-3xl font-semibold leading-tight text-[var(--foreground)]">
                      {item.display_title || item.title}
                    </h1>
                    <RatingDistributionBadge
                      count={item.rating_count}
                      distribution={item.rating_distribution}
                      value={item.rating}
                    />
                  </div>
                  {item.subtitle || item.orig_title ? (
                    <p className="mt-2 min-w-0 max-w-full break-words text-base text-[#44474c]">
                      {item.subtitle || item.orig_title}
                    </p>
                  ) : null}
                </div>

                <div className="flex min-w-0 max-w-full flex-wrap gap-2">
                  {meta.map((entry, index) => (
                    <MetaBadge
                      entry={entry}
                      key={`${entry.query || ""}:${entry.text}:${index}`}
                    />
                  ))}
                </div>

                <p className="min-w-0 max-w-full whitespace-pre-line break-words text-lg leading-relaxed text-[#44474c]">
                  {description}
                </p>
                <DetailHashtags tags={getDetailHashtags(item.tags || [], t)} />
              </div>
            </section>

            <Suspense
              fallback={
                <CommunitySectionFallback
                  itemUuid={item.uuid}
                />
              }
            >
              <CommunitySection category={item.category} itemUuid={item.uuid} />
            </Suspense>
          </div>
        </main>
        <ShortReviewFloatingButton initialMark={initialMark} itemUuid={item.uuid} />
        <DetailBackToTop />
      </>
    );
  }

  return (
    <DetailUnavailable
      category={category}
      status={itemResult.status}
      uuid={uuid}
    />
  );
}

async function CommunitySection({
  category,
  itemUuid,
}: {
  category: string;
  itemUuid: string;
}) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const [initialCommentsPage, initialReviewsPage, initialOwnEntries] = await Promise.all([
    getCommunityCommentPage({ category, itemUuid, locale, page: 1, session, type: "comment" }),
    getCommunityCommentPage({ category, itemUuid, locale, page: 1, session, type: "review" }),
    getCommunityOwnEntries({ category, itemUuid, locale, session }),
  ]);

  return (
    <section className="space-y-4 border-t border-[#e2e2e5] pt-6" id="comments">
      <CommunityList
        category={category}
        initialCommentsPage={initialCommentsPage}
        initialOwnEntries={initialOwnEntries}
        initialReviewsPage={initialReviewsPage}
        itemUuid={itemUuid}
        neodbInstance={session?.instance ?? ""}
        reviewActions={
          <DetailReviewActions
            category={category}
            itemUuid={itemUuid}
            mode="review"
          />
        }
      />
    </section>
  );
}

function CommunitySectionFallback({
  itemUuid,
}: {
  itemUuid: string;
}) {
  return (
    <section className="space-y-4 border-t border-[#e2e2e5] pt-6" id="comments">
      <CommunityLoadingSkeleton />
    </section>
  );
}

async function DetailUnavailable({
  category,
  status,
  uuid,
}: {
  category: string;
  status: "not-found" | "unavailable";
  uuid: string;
}) {
  const t = await getT();
  const isNotFound = status === "not-found";

  return (
    <>
      <DetailTopBar
        category={category}
        closeOnly
        coverUrl={null}
        itemUuid={uuid}
        title={isNotFound ? t("detail.notFound") : t("detail.loadError")}
      />
      <div aria-hidden="true" className="h-16" />
      <DetailPageExitReset itemUuid={uuid} />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-20 pt-5 text-[var(--foreground)]"
        data-detail-page
      >
        <div className="mx-auto max-w-4xl">
          <div className="rounded-[2rem] border border-white/70 bg-white/70 p-6 shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
            <p className="text-base font-bold text-[var(--foreground)]">
              {isNotFound
                ? t("detail.notFoundTitle")
                : t("detail.unavailableTitle")}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#75777d]">
              {isNotFound
                ? t("detail.notFoundDescription")
                : t("detail.unavailableDescription")}
            </p>
          </div>
        </div>
      </main>
    </>
  );
}

async function fetchItem(category: string, uuid: string) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  let payload: unknown;

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${getItemApiPath(category, uuid)}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 30 },
      },
      8_000,
    );

    if (!response.ok) {
      return {
        item: null,
        status: response.status === 404 ? "not-found" : "unavailable",
      } satisfies DetailItemResult;
    }

    payload = await response.json();
  } catch (error) {
    console.error("[neodb] item fetch failed", error);
    return { item: null, status: "unavailable" } satisfies DetailItemResult;
  }

  // Not inside the try/catch above: redirect() throws to signal Next's
  // router, which the catch block would otherwise swallow as a fetch error.
  const recastPath = resolveRecastPath(payload, category, uuid);

  if (recastPath) {
    redirect(recastPath);
  }

  const item = payload as DetailItem;
  const canonicalCategory = resolveCategoryFromItemType(item.type);

  if (canonicalCategory && canonicalCategory !== category) {
    redirect(`/item/${canonicalCategory}/${encodeURIComponent(uuid)}`);
  }

  return { item, status: "found" } satisfies DetailItemResult;
}

/**
 * NeoDB returns `{ message: "Item recasted", url: "/api/..." }` instead of
 * item fields when a uuid's category or canonical identity changed (e.g. a
 * TVShow later split into seasons, or a duplicate merged into another item).
 * Resolves the app's own canonical `/item/{category}/{uuid}` path so the page
 * can redirect instead of rendering an empty item.
 */
function resolveRecastPath(
  payload: unknown,
  requestedCategory: string,
  requestedUuid: string,
): string | null {
  if (
    !payload ||
    typeof payload !== "object" ||
    typeof (payload as Record<string, unknown>).message !== "string" ||
    typeof (payload as Record<string, unknown>).url !== "string" ||
    typeof (payload as Record<string, unknown>).uuid === "string"
  ) {
    return null;
  }

  const apiUrl = (payload as { url: string }).url;
  const uuidMatch = apiUrl.match(/\/([^/]+)\/?$/);
  const canonicalUuid = uuidMatch ? uuidMatch[1] : requestedUuid;
  const canonicalCategory = resolveCategoryFromApiPath(apiUrl) || requestedCategory;
  const canonicalPath = `/item/${canonicalCategory}/${encodeURIComponent(canonicalUuid)}`;
  const requestedPath = `/item/${requestedCategory}/${encodeURIComponent(requestedUuid)}`;

  return canonicalPath === requestedPath ? null : canonicalPath;
}

async function fetchInitialMark(itemUuid: string): Promise<DetailInitialMark> {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return {
      auth: "guest",
      ...emptyMarkSnapshot(itemUuid),
    };
  }

  try {
    return {
      auth: "ready",
      ...(await fetchShelfMarkSnapshot(session, itemUuid)),
    };
  } catch (error) {
    console.error("[neodb] initial mark fetch failed", error);
    return {
      auth: "ready",
      ...emptyMarkSnapshot(itemUuid),
    };
  }
}

async function getDetailTmdbRegion(locale: Awaited<ReturnType<typeof getLocale>>) {
  const cookieStore = await cookies();
  const value = cookieStore.get(TMDB_REGION_COOKIE)?.value;

  return value && isTmdbRegion(value) ? value : getDefaultTmdbRegion(locale);
}

async function fetchTmdbStills(item: DetailItem) {
  const mediaType: TmdbMediaType | null =
    item.category === "movie" ? "movie" : item.category === "tv" ? "tv" : null;

  return mediaType ? getTmdbStills(item, mediaType) : null;
}

async function fetchSeasonOptions(
  category: string,
  item: DetailItem,
  t: Awaited<ReturnType<typeof getT>>,
): Promise<SeasonOption[]> {
  const seasonUuids =
    category === "tv"
      ? item.season_uuids
      : category === "tv-season" && item.parent_uuid
        ? await fetchParentSeasonUuids(item.parent_uuid)
        : null;

  if (!seasonUuids || seasonUuids.length < 2) {
    return [];
  }

  // season_uuids is not guaranteed to be in season_number order (a specials
  // "season 0" can appear anywhere in it), so each season's own authoritative
  // number has to be looked up rather than inferred from array position.
  const knownSeasonNumber =
    category === "tv-season" && typeof item.season_number === "number"
      ? { number: item.season_number, uuid: item.uuid }
      : null;

  const seasonNumbers = await Promise.all(
    seasonUuids.map((uuid) =>
      knownSeasonNumber && uuid === knownSeasonNumber.uuid
        ? knownSeasonNumber.number
        : fetchSeasonNumber(uuid),
    ),
  );

  return seasonUuids
    .map((uuid, index) => ({ seasonNumber: seasonNumbers[index], uuid }))
    .filter(
      (entry): entry is { seasonNumber: number; uuid: string } =>
        typeof entry.seasonNumber === "number",
    )
    .sort((a, b) => a.seasonNumber - b.seasonNumber)
    .map(({ seasonNumber, uuid }) => ({
      label: formatSeasonLabel(seasonNumber, t),
      uuid,
    }));
}

function formatSeasonLabel(
  seasonNumber: number,
  t: Awaited<ReturnType<typeof getT>>,
) {
  return seasonNumber === 0
    ? t("detail.seasons.special")
    : t("detail.seasons.season").replace("{number}", String(seasonNumber));
}

async function fetchParentSeasonUuids(parentUuid: string) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${getItemApiPath("tv", parentUuid)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 * 30 } },
      8_000,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { season_uuids?: string[] };

    return data.season_uuids || null;
  } catch (error) {
    console.error("[neodb] parent season fetch failed", error);
    return null;
  }
}

async function fetchSeasonNumber(uuid: string): Promise<number | null> {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}${getItemApiPath("tv-season", uuid)}`,
      { headers: { Accept: "application/json" }, next: { revalidate: 60 * 30 } },
      8_000,
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { season_number?: number };

    return typeof data.season_number === "number" ? data.season_number : null;
  } catch (error) {
    console.error("[neodb] season number fetch failed", error);
    return null;
  }
}

function toAbsoluteUrl(value: string) {
  if (!value || /^https?:\/\//.test(value)) {
    return value;
  }

  return new URL(value, getNeodbBaseUrl()).toString();
}
