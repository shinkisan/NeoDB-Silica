import Image from "next/image";
import { getNeodbBaseUrl, normalizeNeodbItem, type HomeItem, type NeodbItem } from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { getT } from "@/i18n/server";
import { SearchResultLink, SearchScrollRestorer } from "./search-result-link";
import { SearchTopBar } from "./search-top-bar";
import { SearchCatalogPrompt } from "./catalog-fetch-dialog";
import { SearchPagination } from "./search-pagination";
import { SearchResultsFrame } from "./search-results-frame";

type SearchPageProps = {
  searchParams: Promise<{
    q?: string;
    category?: string;
    page?: string;
  }>;
};

const SEARCH_RESULT_BOUNDARY_PAGE = 100;

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const t = await getT();
  const filters = [
    { id: "all", label: t("search.category.all") },
    { id: "book", label: t("search.category.book") },
    { id: "movie", label: t("search.category.movie") },
    { id: "tv", label: t("search.category.tv") },
    { id: "movie,tv", label: t("search.category.movieTv") },
    { id: "music", label: t("search.category.music") },
    { id: "game", label: t("search.category.game") },
    { id: "podcast", label: t("search.category.podcast") },
    { id: "performance", label: t("search.category.performance") },
  ];
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const category = params.category || "all";
  const parsedPage = Number(params.page || 1);
  const requestedPage = Number.isFinite(parsedPage)
    ? Math.max(1, Math.floor(parsedPage))
    : 1;
  const page = Math.min(requestedPage, SEARCH_RESULT_BOUNDARY_PAGE);
  const isBoundaryPage = Boolean(query) && page === SEARCH_RESULT_BOUNDARY_PAGE;
  const result =
    query && !isBoundaryPage ? await searchItems(query, category, page) : null;
  const navigablePages = result
    ? Math.min(result.pages, SEARCH_RESULT_BOUNDARY_PAGE)
    : isBoundaryPage
      ? SEARCH_RESULT_BOUNDARY_PAGE
      : 0;
  return (
    <main
      className="search-page-enter min-h-dvh bg-[var(--background)] px-4 pb-28 pt-8 text-[var(--foreground)]"
      data-search-page
    >
      <SearchScrollRestorer />
      <section className="mx-auto max-w-2xl">
        <SearchTopBar category={category} filters={filters} query={query} />

        {query ? (
          <div className="mb-4 flex min-w-0 items-start justify-between gap-3 px-1 text-sm text-[#75777d]">
            <span className="min-w-0 break-words">
              {result
                ? t("search.resultCount").replace("{count}", String(result.count))
                : t("search.resultSummary").replace("{query}", query)}
            </span>
            {result || isBoundaryPage ? (
              <span className="shrink-0 whitespace-nowrap">
                {t("search.pageLabel")
                  .replace("{page}", String(page))
                  .replace("{pages}", String(navigablePages))}
              </span>
            ) : null}
          </div>
        ) : null}

        {!query ? (
          <EmptyState text={t("search.emptyQuery")} />
        ) : null}

        {result?.error ? <EmptyState text={result.error} /> : null}

        {result && !result.error && result.items.length === 0 ? (
          <>
            <EmptyState text={t("search.emptyResults")} />
            <SearchCatalogPrompt initialUrl={query} />
          </>
        ) : null}

        {isBoundaryPage ? (
          <>
            <EmptyState text={t("search.resultBoundary")} />
            <SearchCatalogPrompt initialUrl={query} />
            <SearchPagination
              category={category}
              currentPage={page}
              pages={navigablePages}
              query={query}
            />
          </>
        ) : null}

        {result && result.items.length > 0 ? (
          <>
            <SearchResultsFrame key={`${query}:${category}:${page}`}>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {result.items.map((item, index) => (
                  <SearchResultCard
                    index={index}
                    item={item}
                    key={`${item.id}-${index}`}
                  />
                ))}
              </div>
            </SearchResultsFrame>
            {page >= result.pages ? <SearchCatalogPrompt initialUrl={query} /> : null}
            <SearchPagination
              category={category}
              currentPage={page}
              pages={navigablePages}
              query={query}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

async function searchItems(query: string, category: string, page: number) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  const url = new URL(`${baseUrl}/api/catalog/search`);
  url.searchParams.set("query", query);
  url.searchParams.set("page", String(page));

  if (category && category !== "all") {
    url.searchParams.set("category", category);
  }

  try {
    const response = await fetchWithTimeout(
      url,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 5 },
      },
      8_000,
    );

    if (!response.ok) {
      throw new Error("搜索请求失败。");
    }

    const payload = (await response.json()) as {
      data: NeodbItem[];
      pages: number;
      count: number;
    };

    return {
      count: payload.count,
      pages: payload.pages,
      items: payload.data.map((item) => normalizeNeodbItem(item, baseUrl)),
    };
  } catch (error) {
    return {
      count: 0,
      pages: 0,
      items: [],
      error: error instanceof Error ? error.message : "无法执行搜索。",
    };
  }
}

function SearchResultCard({
  index,
  item,
}: {
  index: number;
  item: HomeItem;
}) {
  const detailPath =
    item.detailPath || `/item/${item.category}/${encodeURIComponent(item.id)}`;

  return (
    <article className="group overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 active:scale-[0.98]">
      <SearchResultLink href={detailPath}>
        <div className="relative aspect-[3/4] bg-[#e2e2e5]">
          {item.coverUrl ? (
            <Image
              alt={item.title}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              decoding="async"
              fill
              loading={index < 9 ? "eager" : "lazy"}
              quality={75}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              src={item.coverUrl}
              unoptimized={process.env.NODE_ENV !== "production"}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-[#75777d]">
              {item.title}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 pt-16">
            <div className="rounded-2xl border border-white/30 bg-white/20 p-2.5 text-white backdrop-blur-md">
              <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">
                {typeof item.rating === "number" ? (
                  <span className="mr-1.5 inline-flex rounded-full border border-white/25 bg-white/35 px-1.5 pt-[3px] pb-0.5 align-[0.125em] text-[10px] font-semibold backdrop-blur-sm">
                    {item.rating.toFixed(1)}
                  </span>
                ) : null}
                {item.title}
              </p>
              {item.creator ? (
                <p className="mt-1 truncate text-xs text-white/80">
                  {item.creator}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </SearchResultLink>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm text-[#44474c]">
      {text}
    </div>
  );
}
