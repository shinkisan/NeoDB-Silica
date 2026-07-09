"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useRef, useState } from "react";
import { showToast } from "@/components/app-toast";
import { I18nContext } from "@/components/i18n-provider";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { CatalogFetchDialog } from "@/app/search/catalog-fetch-dialog";
import { type Locale } from "@/i18n/config";
import { parseCatalogDetailPath } from "@/lib/catalog-link";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { type TmdbRegion } from "@/lib/tmdb-regions";

const MAP_STORAGE_KEY = "bielu:v1:tmdb-neodb-map";
const MAP_MAX_ENTRIES = 200;
const SESSION_CACHE_PREFIX = "bielu:v1:tmdb:now-playing:";

type TmdbMovieItem = {
  originalTitle: string;
  posterUrl: string | null;
  releaseDate: string;
  title: string;
  tmdbId: number;
  tmdbUrl: string;
};

type TmdbNowPlayingResponse = {
  hasMore: boolean;
  items: TmdbMovieItem[];
  page: number;
};

type CachedRailPayload = {
  hasMore: boolean;
  items: TmdbMovieItem[];
  page: number;
};

type RailStatus = "loading" | "ready" | "error" | "unavailable";

function fetchTmdbPage(
  kind: "now_playing" | "upcoming",
  region: TmdbRegion,
  locale: Locale,
  page: number,
) {
  const params = new URLSearchParams({
    kind,
    locale,
    page: String(page),
    region,
  });

  return fetch(`/api/tmdb/now-playing?${params.toString()}`).then(
    async (response) => {
      if (response.status === 503) {
        return "unavailable" as const;
      }

      if (!response.ok) {
        throw new Error("tmdb_failed");
      }

      return (await response.json()) as TmdbNowPlayingResponse;
    },
  );
}

export function TmdbMovieRail({
  kind,
  onBeforeNavigate,
  region,
}: {
  kind: "now_playing" | "upcoming";
  onBeforeNavigate?: () => void;
  region: TmdbRegion;
}) {
  const t = useT();
  const router = useRouter();
  const { locale } = useContext(I18nContext);
  const [items, setItems] = useState<TmdbMovieItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [status, setStatus] = useState<RailStatus>("loading");
  const [pendingTmdbId, setPendingTmdbId] = useState<number | null>(null);
  const [catalogDialogUrl, setCatalogDialogUrl] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);
  const requestIdRef = useRef(0);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const cacheKey = `${SESSION_CACHE_PREFIX}${kind}:${region}:${locale}`;
    const cached = retryNonce === 0 ? readSessionCache(cacheKey) : null;

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      if (cached) {
        setItems(cached.items);
        setPage(cached.page);
        setHasMore(cached.hasMore);
        setStatus("ready");
      } else {
        setItems([]);
        setPage(1);
        setHasMore(false);
        setStatus("loading");
      }
    });

    if (cached) {
      return () => {
        cancelled = true;
      };
    }

    fetchTmdbPage(kind, region, locale, 1)
      .then((data) => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        if (data === "unavailable") {
          setStatus("unavailable");
          return;
        }

        setItems(data.items);
        setPage(1);
        setHasMore(data.hasMore);
        setStatus("ready");
        writeSessionCache(cacheKey, {
          hasMore: data.hasMore,
          items: data.items,
          page: 1,
        });
      })
      .catch(() => {
        if (cancelled || requestIdRef.current !== requestId) {
          return;
        }

        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [kind, locale, region, retryNonce]);

  useEffect(() => {
    if (status !== "ready" || !hasMore || isLoadingMore) {
      return;
    }

    const target = loadMoreRef.current;

    if (!target) {
      return;
    }

    const requestId = requestIdRef.current;
    const nextPage = page + 1;
    const cacheKey = `${SESSION_CACHE_PREFIX}${kind}:${region}:${locale}`;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setIsLoadingMore(true);

        fetchTmdbPage(kind, region, locale, nextPage)
          .then((data) => {
            if (requestIdRef.current !== requestId) {
              return;
            }

            if (data === "unavailable") {
              setHasMore(false);
              return;
            }

            setItems((current) => {
              const merged = [...current, ...data.items];
              writeSessionCache(cacheKey, {
                hasMore: data.hasMore,
                items: merged,
                page: nextPage,
              });
              return merged;
            });
            setPage(nextPage);
            setHasMore(data.hasMore);
          })
          .catch(() => {
            // Leave hasMore as-is; scrolling the sentinel back into view retries.
          })
          .finally(() => {
            if (requestIdRef.current === requestId) {
              setIsLoadingMore(false);
            }
          });
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [hasMore, isLoadingMore, kind, locale, page, region, status]);

  async function handleSelect(item: TmdbMovieItem) {
    if (pendingTmdbId !== null) {
      return;
    }

    const cachedPath = readMappedDetailPath(item.tmdbId);

    if (cachedPath) {
      navigateToDetail(cachedPath);
      return;
    }

    setPendingTmdbId(item.tmdbId);

    try {
      const response = await fetch(
        `/api/neodb/catalog-fetch?url=${encodeURIComponent(item.tmdbUrl)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { detailPath?: string; message?: string | null; url?: string }
        | null;

      if (response.status === 302 && (payload?.detailPath || payload?.url)) {
        const detailPath =
          payload.detailPath || parseCatalogDetailPath(payload.url || "");

        if (detailPath) {
          writeMappedDetailPath(item.tmdbId, detailPath);
          setPendingTmdbId(null);
          navigateToDetail(detailPath);
          return;
        }
      }

      if (response.status === 202) {
        setPendingTmdbId(null);
        setCatalogDialogUrl(item.tmdbUrl);
        return;
      }

      setPendingTmdbId(null);
      showToast(t("search.catalogFetch.error"), "error");
    } catch {
      setPendingTmdbId(null);
      showToast(t("search.catalogFetch.error"), "error");
    }
  }

  function navigateToDetail(href: string) {
    onBeforeNavigate?.();
    requestDetailScrollTopForHref(href);
    pushNavigationFrame("detail", href);
    router.push(href);
  }

  return (
    <div>
      {status === "loading" ? <TmdbRailSkeleton /> : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-center text-sm text-red-900">
          <p>{t("tmdbDiscovery.error")}</p>
          <button
            className="mt-3 rounded-full bg-[var(--theme-primary)] px-4 py-2 text-sm font-bold text-white transition hover:bg-[var(--theme-primary-hover)]"
            onClick={() => setRetryNonce((current) => current + 1)}
            type="button"
          >
            {t("tmdbDiscovery.retry")}
          </button>
        </div>
      ) : null}

      {status === "unavailable" ? (
        <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm text-[#44474c]">
          {t("tmdbDiscovery.unavailable")}
        </div>
      ) : null}

      {status === "ready" && items.length === 0 ? (
        <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm text-[#44474c]">
          {t("tmdbDiscovery.empty")}
        </div>
      ) : null}

      {status === "ready" && items.length > 0 ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {items.map((item, index) => (
              <TmdbMovieCard
                index={index}
                isPending={pendingTmdbId === item.tmdbId}
                item={item}
                key={item.tmdbId}
                onSelect={() => void handleSelect(item)}
              />
            ))}
          </div>
          {hasMore ? (
            <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
          ) : null}
          {isLoadingMore ? (
            <div className="mt-4 flex justify-center">
              <LoopSpinnerMuted />
            </div>
          ) : null}
          {!hasMore && !isLoadingMore ? (
            <div className="mt-6 text-center text-xs font-semibold text-[#75777d]">
              {t("home.endOfList")}
            </div>
          ) : null}
          <p className="mt-4 text-center text-xs font-semibold text-[#75777d]">
            <a
              className="hover:underline"
              href="https://www.themoviedb.org"
              rel="noopener noreferrer"
              target="_blank"
            >
              {t("tmdbDiscovery.attribution")}
            </a>
          </p>
        </>
      ) : null}

      {catalogDialogUrl ? (
        <CatalogFetchDialog
          initialMessage={t("search.catalogFetch.workingHint")}
          initialPhase="working"
          initialUrl={catalogDialogUrl}
          skipForm
          onClose={() => setCatalogDialogUrl(null)}
          onResolved={(detailPath) => {
            const resolvedItem = items.find(
              (candidate) => candidate.tmdbUrl === catalogDialogUrl,
            );

            if (resolvedItem) {
              writeMappedDetailPath(resolvedItem.tmdbId, detailPath);
            }

            onBeforeNavigate?.();
          }}
        />
      ) : null}
    </div>
  );
}

function TmdbMovieCard({
  index,
  isPending,
  item,
  onSelect,
}: {
  index: number;
  isPending: boolean;
  item: TmdbMovieItem;
  onSelect: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 active:scale-[0.98]">
      <button
        className="block w-full text-left"
        disabled={isPending}
        onClick={onSelect}
        type="button"
      >
        <div className="relative aspect-[3/4] bg-[#e2e2e5]">
          {item.posterUrl ? (
            <Image
              alt={item.title}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              decoding="async"
              fetchPriority={index === 0 ? "high" : "auto"}
              fill
              loading={index < 9 ? "eager" : "lazy"}
              quality={75}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              src={item.posterUrl}
              unoptimized
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-[#75777d]">
              {item.title}
            </div>
          )}
          {isPending ? (
            <div className="absolute inset-0 grid place-items-center bg-black/40">
              <LoopSpinner />
            </div>
          ) : null}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 pt-16">
            <div className="translate-y-2 rounded-2xl border border-white/30 bg-white/20 p-2.5 text-white opacity-95 backdrop-blur-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">
                {item.title}
              </p>
              <p className="mt-1 truncate text-xs text-white/80">
                {item.releaseDate}
              </p>
            </div>
          </div>
        </div>
      </button>
    </article>
  );
}

function TmdbRailSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {Array.from({ length: 9 }, (_, index) => (
        <div
          className="animate-pulse rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/5"
          key={index}
        >
          <div className="aspect-[3/4] rounded-xl bg-[#e2e2e5]" />
        </div>
      ))}
    </div>
  );
}

function LoopSpinner() {
  return (
    <svg
      aria-hidden="true"
      className="size-8 animate-spin text-white"
      viewBox="0 0 48 48"
    >
      <circle
        className="opacity-25"
        cx="24"
        cy="24"
        fill="none"
        r="18"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M42 24a18 18 0 0 0-18-18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

function LoopSpinnerMuted() {
  return (
    <svg
      aria-hidden="true"
      className="size-6 animate-spin text-[#75777d]"
      viewBox="0 0 48 48"
    >
      <circle
        className="opacity-25"
        cx="24"
        cy="24"
        fill="none"
        r="18"
        stroke="currentColor"
        strokeWidth="5"
      />
      <path
        d="M42 24a18 18 0 0 0-18-18"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="5"
      />
    </svg>
  );
}

function readSessionCache(key: string): CachedRailPayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(key);

    if (!raw) {
      return null;
    }

    return JSON.parse(raw) as CachedRailPayload;
  } catch {
    return null;
  }
}

function writeSessionCache(key: string, payload: CachedRailPayload) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(key, JSON.stringify(payload));
}

function readMappedDetailPath(tmdbId: number): string | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(MAP_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};

    return map[String(tmdbId)] || null;
  } catch {
    return null;
  }
}

function writeMappedDetailPath(tmdbId: number, detailPath: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const raw = window.localStorage.getItem(MAP_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};

    map[String(tmdbId)] = detailPath;

    const keys = Object.keys(map);

    if (keys.length > MAP_MAX_ENTRIES) {
      delete map[keys[0]];
    }

    window.localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage write failures (e.g. quota exceeded or private mode).
  }
}
