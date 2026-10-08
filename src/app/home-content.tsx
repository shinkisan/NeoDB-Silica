"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { MouseEvent, PointerEvent, ReactNode } from "react";
import {
  lazy,
  Suspense,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { showToast } from "@/components/app-toast";
import { Dropdown } from "@/components/dropdown";
import { useFeatureFlags } from "@/components/feature-flags";
import { HorizontalScrollControls } from "@/components/horizontal-scroll-controls";
import { I18nContext } from "@/components/i18n-provider";
import {
  addSearchHistory,
  clearSearchHistory,
  readSearchHistory,
  SearchHistoryPopover,
} from "@/components/search-history";
import { IsbnScannerButton } from "@/components/isbn-scanner";
import { SearchSuggestionsPopover } from "@/components/search-suggestions";
import { SearchScopeSelect } from "@/components/search-scope-select";
import { SortIcon } from "@/components/sort-icon";
import { useSearchFocusDismissal } from "@/components/use-search-focus-dismissal";
import { useT } from "@/components/use-t";
import { CatalogFetchDialog, isSupportedCatalogLink } from "@/app/search/catalog-fetch-dialog";
import { APP_RESET_EVENT } from "@/lib/app-reset";
import { parseCatalogDetailPath, parseNeodbDetailPath } from "@/lib/catalog-link";
import { getCoverProxySrc } from "@/lib/cover-image";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { addDismissedItem } from "@/lib/dismissed-items";
import {
  HOME_FEED_CACHE_PREFIX,
  getHomeFeedCacheKey,
  getPersonalHomeFeedCacheKey,
} from "@/lib/home-feed-cache";
import {
  noteSearchEntry,
  pushNavigationFrame,
  replaceNavigationFrame,
} from "@/components/navigation-history";
import {
  DEFAULT_HOME_CATEGORY,
  HOME_TAG_ORDER_EVENT,
  HOME_TAG_ORDER_KEY,
  homeTags,
  isHomeTagAvailable,
  isPersonalHomeTag,
  normalizeHomeTagOrder,
  sortHomeTags,
} from "@/lib/home-tags";
import { type Locale } from "@/i18n/config";
import { FEATURED_COLLECTIONS_EMPTY_COOKIE } from "@/lib/featured-collections";
import type { HomeItem } from "@/lib/neodb";
import {
  getDefaultTmdbRegion,
  isTmdbRegion,
  TMDB_REGION_COOKIE,
  TMDB_REGION_STORAGE_KEY,
  TMDB_REGIONS,
  type TmdbRegion,
} from "@/lib/tmdb-regions";
import { HomeTagRailSkeleton } from "./(home)/home-shell-skeleton";
import { TmdbMovieRail } from "./(home)/tmdb-movie-rail";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const LazyCategoryOrderDialog = lazy(() =>
  import("@/components/category-order-dialog").then((module) => ({
    default: module.CategoryOrderDialog,
  })),
);

const CACHE_TTL = 60 * 60 * 1000;
const HOME_CATEGORY_KEY = `${STORAGE_PREFIX}v1:home:category`;
const HOME_MOVIE_SUBTAB_KEY = `${STORAGE_PREFIX}v1:home-movie-subtab`;
const HOME_COLLECTION_SUBTAB_KEY = `${STORAGE_PREFIX}v1:home-collection-subtab`;
const HOME_PERSONAL_SUBTAB_KEY = `${STORAGE_PREFIX}v1:home-personal-subtab`;
const HOME_LEAVING_KEY = `${STORAGE_PREFIX}v1:home:leaving`;
const HOME_RESTORE_KEY = `${STORAGE_PREFIX}v1:home:restore`;
const HOME_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:home:scroll:`;
const COLLECTION_SCROLL_TOP_PREFIX = `${STORAGE_PREFIX}v1:collection-scroll-top:`;
const LAST_NON_SEARCH_PATH_KEY = `${STORAGE_PREFIX}v1:last-non-search-path`;
const INITIAL_RENDER_COUNT = 18;
const RENDER_BATCH_SIZE = 12;
const HOME_SWIPE_EXIT_MS = 160;
const DISMISS_LONG_PRESS_MS = 420;
const DISMISS_LONG_PRESS_MOVE_PX = 12;

/** Raised when the personal feed needs a session the visitor doesn't have. */
class PersonalFeedLoginRequired extends Error {}

let hasHandledHomeReload = false;

type CachePayload = {
  cachedAt: number;
  items: HomeCardItem[];
  /** The personal feed caches both of its groups in one entry. */
  friendItems?: HomeCardItem[];
};

type TrendingResponse = {
  items: HomeCardItem[];
  fetchedAt: string;
  source: string;
};

type RecommendationsResponse = TrendingResponse & {
  friendItems?: HomeCardItem[];
};

type FeaturedCollectionSection = {
  id: string;
  items: HomeCardItem[];
  title: string;
};

type FeaturedCollectionsResponse = {
  fetchedAt: string;
  sections: FeaturedCollectionSection[];
  source: string;
};

declare global {
  interface Window {
    __appHomeTrendingBootstrap?: {
      category: string;
      promise: Promise<TrendingResponse>;
    };
  }
}

type HomeCardItem = Pick<
  HomeItem,
  | "category"
  | "coverUrl"
  | "creator"
  | "detailPath"
  | "id"
  | "kind"
  | "rating"
  | "title"
>;

type SwipeTransition = {
  direction: "left" | "right";
  phase: "exit" | "enter";
};

type MovieSubtab = "trending" | "now_playing" | "upcoming";
type CollectionSubtab = "trending" | "lists";
type PersonalSubtab = "forYou" | "friends";
type HomeFeedStatus = "loading" | "ready" | "error" | "guest";

export default function HomeContentRoot({
  featuredCollectionsEnabled,
  isCoverProxyEnabled,
  personalFeedScope,
}: {
  featuredCollectionsEnabled: boolean;
  isCoverProxyEnabled: boolean;
  personalFeedScope: string | null;
}) {
  return (
    <Suspense fallback={<HomeSkeleton />}>
      <HomeContent
        featuredCollectionsEnabled={featuredCollectionsEnabled}
        isCoverProxyEnabled={isCoverProxyEnabled}
        personalFeedScope={personalFeedScope}
      />
    </Suspense>
  );
}

function HomeContent({
  featuredCollectionsEnabled: initialFeaturedCollectionsEnabled,
  isCoverProxyEnabled,
  personalFeedScope,
}: {
  featuredCollectionsEnabled: boolean;
  isCoverProxyEnabled: boolean;
  personalFeedScope: string | null;
}) {
  const router = useRouter();
  const canUsePersonalFeed = personalFeedScope !== null;
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState(() =>
    homeTags.filter((tag) => isHomeTagAvailable(tag.id, canUsePersonalFeed)),
  );
  const defaultHomeCategory = filters[0]?.id || DEFAULT_HOME_CATEGORY;
  const categoryParam = searchParams.get("category") || defaultHomeCategory;
  const activeFilter = isHomeFilter(categoryParam, filters)
    ? categoryParam
    : defaultHomeCategory;
  const t = useT();
  const { locale } = useContext(I18nContext);
  const searchScopes = [
    { id: "all", label: t("search.category.all") },
    ...filters
      .filter((f) => f.id !== "collection" && !isPersonalHomeTag(f.id))
      .map((f) => ({ id: f.id, label: t(`homeTags.${f.id}`) })),
  ];
  const [searchScope, setSearchScope] = useState("all");
  const [query, setQuery] = useState("");
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState<{
    message?: string;
    phase?: "form" | "working" | "success" | "error";
    skipForm?: boolean;
    url: string;
  } | null>(null);
  const [items, setItems] = useState<HomeCardItem[]>([]);
  const [dismissPreviewId, setDismissPreviewId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER_COUNT);
  const [status, setStatus] = useState<HomeFeedStatus>("loading");
  const [error, setError] = useState("");
  const [refreshRequest, setRefreshRequest] = useState<{
    category: string;
    nonce: number;
  } | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isTagOrderOpen, setIsTagOrderOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<string | null>(null);
  const [swipeTransition, setSwipeTransition] = useState<SwipeTransition | null>(null);
  const { tmdb: tmdbEnabled } = useFeatureFlags();
  const [movieSubtab, setMovieSubtab] = useState<MovieSubtab>("trending");
  const [collectionSubtab, setCollectionSubtab] =
    useState<CollectionSubtab>("trending");
  const [personalSubtab, setPersonalSubtab] = useState<PersonalSubtab>("forYou");
  const [personalFeed, setPersonalFeed] = useState<{
    forYou: HomeCardItem[];
    friends: HomeCardItem[];
  } | null>(null);
  const personalSubtabRef = useRef<PersonalSubtab>("forYou");
  const [featuredCollectionSections, setFeaturedCollectionSections] = useState<
    FeaturedCollectionSection[]
  >([]);
  // Configured collections may not actually resolve on this NeoDB instance
  // (curated UUIDs from another deployment's config). The server already
  // combines the static "is anything configured" check with the recalled
  // empty-cookie (see `(home)/page.tsx`), so this prop is correct from the
  // very first render; a fetch confirming zero sections downgrades it further.
  const [featuredCollectionsEnabled, setFeaturedCollectionsEnabled] = useState(
    initialFeaturedCollectionsEnabled,
  );
  const [tmdbRegion, setTmdbRegion] = useState<TmdbRegion>(() =>
    readStoredTmdbRegion(locale),
  );
  const isRestoringScrollRef = useRef(false);
  const isNormalizingReloadRef = useRef(false);
  const swipeExitTimerRef = useRef<number | null>(null);
  const gestureStartRef = useRef<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressGestureClickRef = useRef(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLFormElement>(null);
  const handledSearchShortcutRef = useRef(false);
  const tagViewportRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const shortcutAction = searchParams.get("shortcut");
  const clearShortcutParam = useCallback(() => {
    const nextParams = new URLSearchParams(searchParams.toString());

    if (!nextParams.has("shortcut")) {
      return;
    }

    nextParams.delete("shortcut");
    const nextQuery = nextParams.toString();
    router.replace(nextQuery ? `/?${nextQuery}` : "/", { scroll: false });
  }, [router, searchParams]);

  useSearchFocusDismissal({
    inputRef: searchInputRef,
    rootRef: searchRootRef,
    onDismiss: () => {
      setIsHistoryOpen(false);
      setIsSuggestionsOpen(false);
    },
  });

  useEffect(() => {
    if (shortcutAction !== "search") {
      handledSearchShortcutRef.current = false;
      return;
    }

    if (handledSearchShortcutRef.current) {
      return;
    }

    handledSearchShortcutRef.current = true;
    const frame = requestAnimationFrame(() => {
      setHistoryItems(readSearchHistory());
      setIsHistoryOpen(true);
      setIsSuggestionsOpen(false);
      searchInputRef.current?.focus();
      clearShortcutParam();
    });

    return () => cancelAnimationFrame(frame);
  }, [clearShortcutParam, shortcutAction]);

  useEffect(() => {
    return () => {
      if (swipeExitTimerRef.current !== null) {
        window.clearTimeout(swipeExitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!tmdbEnabled) {
      return;
    }

    const stored = window.localStorage.getItem(HOME_MOVIE_SUBTAB_KEY);

    if (stored === "now_playing" || stored === "upcoming") {
      queueMicrotask(() => setMovieSubtab(stored));
    }
  }, [tmdbEnabled]);

  useEffect(() => {
    if (!featuredCollectionsEnabled) {
      return;
    }

    const stored = window.localStorage.getItem(HOME_COLLECTION_SUBTAB_KEY);

    if (stored === "lists") {
      queueMicrotask(() => setCollectionSubtab(stored));
    }
  }, [featuredCollectionsEnabled]);

  useEffect(() => {
    if (!canUsePersonalFeed) {
      return;
    }

    const stored = window.localStorage.getItem(HOME_PERSONAL_SUBTAB_KEY);

    if (stored === "forYou" || stored === "friends") {
      queueMicrotask(() => {
        personalSubtabRef.current = stored;
        setPersonalSubtab(stored);
      });
    }
  }, [canUsePersonalFeed]);

  /** Shows one of the personal feed's two groups, switching the visitor's
   * sub-tab only when theirs would show nothing while the other has items. */
  function applyPersonalGroups(groups: {
    forYou: HomeCardItem[];
    friends: HomeCardItem[];
  }) {
    const currentTab = personalSubtabRef.current;
    const hasAnything = groups.forYou.length + groups.friends.length > 0;
    const resolvedTab =
      groups[currentTab].length > 0 || !hasAnything
        ? currentTab
        : groups.forYou.length > 0
          ? "forYou"
          : "friends";

    personalSubtabRef.current = resolvedTab;
    setPersonalSubtab(resolvedTab);
    setPersonalFeed(groups);
    setItems(groups[resolvedTab]);
  }

  function selectMovieSubtab(nextSubtab: MovieSubtab) {
    setMovieSubtab(nextSubtab);
    window.localStorage.setItem(HOME_MOVIE_SUBTAB_KEY, nextSubtab);
  }

  function selectCollectionSubtab(nextSubtab: CollectionSubtab) {
    setCollectionSubtab(nextSubtab);
    window.localStorage.setItem(HOME_COLLECTION_SUBTAB_KEY, nextSubtab);
  }

  function selectPersonalSubtab(nextSubtab: PersonalSubtab) {
    personalSubtabRef.current = nextSubtab;
    setPersonalSubtab(nextSubtab);
    window.localStorage.setItem(HOME_PERSONAL_SUBTAB_KEY, nextSubtab);

    // Both groups arrived in one response, so switching is a swap.
    if (personalFeed) {
      setItems(personalFeed[nextSubtab]);
      setVisibleCount(INITIAL_RENDER_COUNT);
    }
  }

  function changeTmdbRegion(nextRegion: string) {
    if (!isTmdbRegion(nextRegion)) {
      return;
    }

    setTmdbRegion(nextRegion);
    window.localStorage.setItem(TMDB_REGION_STORAGE_KEY, nextRegion);
    writeTmdbRegionCookie(nextRegion);
  }

  useEffect(() => {
    writeTmdbRegionCookie(tmdbRegion);
  }, [tmdbRegion]);

  useEffect(() => {
    function syncHomeTags(event?: Event) {
      let order: unknown = null;

      if (event instanceof CustomEvent) {
        order = event.detail;
        // Clear the explicit ?category= override and the bottom nav's "last
        // viewed" memory, or activeFilter stays pinned to the old category.
        window.sessionStorage.removeItem(HOME_CATEGORY_KEY);
        router.replace("/");
      } else {
        try {
          order = JSON.parse(
            window.localStorage.getItem(HOME_TAG_ORDER_KEY) || "[]",
          );
        } catch {
          order = [];
        }
      }

      setFilters(
        sortHomeTags(normalizeHomeTagOrder(order)).filter((tag) =>
          isHomeTagAvailable(tag.id, canUsePersonalFeed),
        ),
      );
    }

    syncHomeTags();
    window.addEventListener(HOME_TAG_ORDER_EVENT, syncHomeTags);
    window.addEventListener(APP_RESET_EVENT, syncHomeTags);

    return () => {
      window.removeEventListener(HOME_TAG_ORDER_EVENT, syncHomeTags);
      window.removeEventListener(APP_RESET_EVENT, syncHomeTags);
    };
  }, [canUsePersonalFeed, router]);

  useEffect(() => {
    if (hasHandledHomeReload) {
      return;
    }

    hasHandledHomeReload = true;

    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (navigation?.type !== "reload") {
      return;
    }

    clearHomeNavigationMemory();
    window.history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const isCollectionListsView =
      activeFilter === "collection" && collectionSubtab === "lists";
    const isPersonal = isPersonalHomeTag(activeFilter);

    if (isCollectionListsView) {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setItems([]);
        setVisibleCount(INITIAL_RENDER_COUNT);
        setStatus("loading");
        setSwipeTransition(null);
        setIsRefreshing(false);
        setRefreshRequest(null);
        setError("");
      });

      const params = new URLSearchParams({ locale });

      fetch(`/api/neodb/featured-collections?${params.toString()}`)
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("NeoDB 榜单收藏单请求失败。");
          }

          return (await response.json()) as FeaturedCollectionsResponse;
        })
        .then((response) => {
          if (cancelled) {
            return;
          }

          setFeaturedCollectionSections(response.sections);
          setStatus("ready");
          setSwipeTransition(null);
          setIsRefreshing(false);
          setError("");

          if (response.sections.length === 0) {
            setFeaturedCollectionsEnabled(false);
            document.cookie = `${FEATURED_COLLECTIONS_EMPTY_COOKIE}=1; path=/; max-age=31536000; SameSite=Lax`;
            selectCollectionSubtab("trending");
          }
        })
        .catch((requestError: unknown) => {
          if (cancelled) {
            return;
          }

          setStatus("error");
          setSwipeTransition(null);
          setIsRefreshing(false);
          setError(
            requestError instanceof Error
              ? requestError.message
              : "无法加载 NeoDB 榜单收藏单。",
          );
        });

      return () => {
        cancelled = true;
      };
    }

    // Personal picks are cached too, but under a key scoped to this session so
    // a shared device never hands one account's picks to the next.
    const cacheKey =
      isPersonal && personalFeedScope
        ? getPersonalHomeFeedCacheKey(personalFeedScope, locale)
        : getHomeFeedCacheKey(activeFilter, locale);
    const isCacheable = !isPersonal || Boolean(personalFeedScope);
    const shouldRefresh = refreshRequest?.category === activeFilter;
    const bootstrap = window.__appHomeTrendingBootstrap;

    const cached =
      !isCacheable || shouldRefresh
        ? null
        : readCache(cacheKey, { allowStale: true });

    if (cached && !isCacheExpired(cached)) {
      queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        if (isPersonal) {
          applyPersonalGroups(toPersonalGroups(cached));
        } else {
          setItems(cached.items);
        }

        setVisibleCount(INITIAL_RENDER_COUNT);
        setStatus("ready");
        setSwipeTransition(null);
        setIsRefreshing(false);
        setError("");
      });
      return;
    }

    queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      setStatus("loading");
      setError("");
    });

    const params = new URLSearchParams({
      // The personal feed splits one blended response into two groups, and the
      // blend interleaves its two sources, so each group can only ever be
      // about half of what we ask for. Ask for the endpoint's maximum.
      limit: isPersonal ? "60" : "42",
      locale,
    });

    if (!isPersonal) {
      params.set("category", activeFilter);
    }

    if (shouldRefresh && refreshRequest) {
      params.set("refresh", String(refreshRequest.nonce));
    }

    const matchingBootstrap =
      !shouldRefresh &&
      bootstrap?.category === activeFilter
        ? bootstrap
        : null;
    const feedRequest =
      matchingBootstrap?.promise ||
      fetch(
        `${
          isPersonal ? "/api/neodb/recommendations" : "/api/neodb/trending"
        }?${params.toString()}`,
      ).then(async (response) => {
        if (isPersonal && response.status === 401) {
          throw new PersonalFeedLoginRequired();
        }

        if (!response.ok) {
          throw new Error(
            isPersonal
              ? "NeoDB 为你推荐请求失败。"
              : "NeoDB 热门内容请求失败。",
          );
        }

        return (await response.json()) as RecommendationsResponse;
      });

    feedRequest
      .then(async (response) => {
        const data = response;

        if (cancelled) {
          return;
        }

        const personalGroups = isPersonal
          ? toPersonalGroups(data as RecommendationsResponse)
          : null;

        if (personalGroups) {
          applyPersonalGroups(personalGroups);
        } else {
          setItems(data.items);
        }

        setVisibleCount(INITIAL_RENDER_COUNT);
        setStatus("ready");
        setSwipeTransition(null);
        setIsRefreshing(false);

        if (isCacheable) {
          writeCache(cacheKey, data.items, personalGroups?.friends);
        }

        if (shouldRefresh) {
          setRefreshRequest(null);
        }
      })
      .catch((requestError: unknown) => {
      if (cancelled) {
        return;
      }

      if (requestError instanceof PersonalFeedLoginRequired) {
        setItems([]);
        setVisibleCount(INITIAL_RENDER_COUNT);
        setStatus("guest");
        setSwipeTransition(null);
        setIsRefreshing(false);
        setRefreshRequest(null);
        setError("");
        return;
      }

      if (
        cached &&
        (cached.items.length > 0 || (cached.friendItems?.length ?? 0) > 0)
      ) {
        if (isPersonal) {
          applyPersonalGroups(toPersonalGroups(cached));
        } else {
          setItems(cached.items);
        }

        setVisibleCount(INITIAL_RENDER_COUNT);
        setStatus("ready");
        setSwipeTransition(null);
        setIsRefreshing(false);
        setRefreshRequest(null);
        setError("");
        return;
      }

      setStatus("error");
      setSwipeTransition(null);
      setIsRefreshing(false);
      setRefreshRequest(null);
        setError(
          isPersonal
            ? ""
            : requestError instanceof Error
              ? requestError.message
              : "无法加载 NeoDB 内容。",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeFilter,
    collectionSubtab,
    locale,
    personalFeedScope,
    refreshRequest,
    searchParams,
  ]);

  useEffect(() => {
    if (status !== "ready" || visibleCount >= items.length) {
      return;
    }

    const target = loadMoreRef.current;

    if (!target) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setVisibleCount((count) =>
          Math.min(items.length, count + RENDER_BATCH_SIZE),
        );
      },
      {
        rootMargin: "600px 0px",
      },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [items.length, status, visibleCount]);

  useEffect(() => {
    if (pendingFilter === activeFilter) {
      queueMicrotask(() => setPendingFilter(null));
    }
  }, [activeFilter, pendingFilter]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = tagViewportRef.current;
      const activeTag = viewport?.querySelector<HTMLElement>(
        `[data-home-filter="${CSS.escape(pendingFilter || activeFilter)}"]`,
      );

      if (viewport && activeTag) {
        centerTagInViewport(viewport, activeTag);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeFilter, filters, pendingFilter]);

  useEffect(() => {
    if (isNormalizingReloadRef.current) {
      if (activeFilter === defaultHomeCategory) {
        isNormalizingReloadRef.current = false;
      }

      return;
    }

    window.sessionStorage.setItem(HOME_CATEGORY_KEY, activeFilter);
  }, [activeFilter, defaultHomeCategory]);

  useEffect(() => {
    function saveScrollPosition() {
      if (
        isNormalizingReloadRef.current ||
        isRestoringScrollRef.current ||
        window.sessionStorage.getItem(HOME_LEAVING_KEY) === "1" ||
        window.sessionStorage.getItem(HOME_RESTORE_KEY) === "1"
      ) {
        return;
      }

      window.sessionStorage.setItem(
        getHomeScrollKey(activeFilter),
        String(window.scrollY),
      );
    }

    if (
      !isNormalizingReloadRef.current &&
      window.sessionStorage.getItem(HOME_RESTORE_KEY) !== "1"
    ) {
      saveScrollPosition();
    }

    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    window.addEventListener("pagehide", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("scroll", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [activeFilter]);

  useEffect(() => {
    if (status !== "ready") {
      return;
    }

    if (window.sessionStorage.getItem(HOME_RESTORE_KEY) !== "1") {
      window.sessionStorage.removeItem(HOME_LEAVING_KEY);
      return;
    }

    const storedScroll = Number(
      window.sessionStorage.getItem(getHomeScrollKey(activeFilter)) || "0",
    );

    if (storedScroll <= 0) {
      window.scrollTo({ top: 0, behavior: "instant" });
      window.sessionStorage.setItem(getHomeScrollKey(activeFilter), "0");
      window.sessionStorage.removeItem(HOME_RESTORE_KEY);
      window.sessionStorage.removeItem(HOME_LEAVING_KEY);
      return;
    }

    isRestoringScrollRef.current = true;

    let frame = 0;
    let attempts = 0;
    const startedAt = performance.now();
    const maxDuration = 1600;

    const finish = () => {
      window.sessionStorage.removeItem(HOME_RESTORE_KEY);
      window.sessionStorage.removeItem(HOME_LEAVING_KEY);
      isRestoringScrollRef.current = false;
      window.sessionStorage.setItem(
        getHomeScrollKey(activeFilter),
        String(window.scrollY),
      );
    };

    const restoreScroll = () => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const nextScroll = Math.min(storedScroll, maxScroll);

      window.scrollTo({ top: nextScroll, behavior: "instant" });

      attempts += 1;

      if (
        Math.abs(window.scrollY - storedScroll) <= 2 ||
        performance.now() - startedAt > maxDuration ||
        attempts > 48
      ) {
        finish();
        return;
      }

      frame = requestAnimationFrame(restoreScroll);
    };

    frame = requestAnimationFrame(restoreScroll);

    return () => {
      cancelAnimationFrame(frame);
      isRestoringScrollRef.current = false;
    };
  }, [activeFilter, status]);

  async function submitSearch(searchValue = query, nextScope = searchScope) {
    const trimmedQuery = searchValue.trim();

    if (!trimmedQuery) {
      return;
    }

    setHistoryItems(addSearchHistory(trimmedQuery));
    setIsHistoryOpen(false);
    setIsSuggestionsOpen(false);

    const neodbDetailPath = parseNeodbDetailPath(trimmedQuery);

    if (neodbDetailPath) {
      requestDetailScrollTopForHref(neodbDetailPath);
      pushNavigationFrame("detail", neodbDetailPath);
      router.push(neodbDetailPath);
      return;
    }

    if (isSupportedCatalogLink(trimmedQuery)) {
      const resolved = await resolveCatalogLink(trimmedQuery);

      if (resolved) {
        return;
      }
    }

    navigateToSearch(trimmedQuery, nextScope);
  }

  function navigateToSearch(searchQuery: string, nextScope = searchScope) {
    const params = new URLSearchParams({
      q: searchQuery,
      category: nextScope,
    });

    const currentPath = `${window.location.pathname}${window.location.search}`;
    window.sessionStorage.setItem(LAST_NON_SEARCH_PATH_KEY, currentPath);
    noteSearchEntry(currentPath);
    const href = `/search?${params.toString()}`;
    pushNavigationFrame("search", href);
    router.push(href);
  }

  function openSuggestedItem(item: { detailPath: string; title: string }) {
    const detailPath = `${item.detailPath}?fromCategory=${encodeURIComponent(activeFilter)}`;
    setHistoryItems(addSearchHistory(item.title));
    setIsHistoryOpen(false);
    setIsSuggestionsOpen(false);
    requestDetailScrollTopForHref(detailPath);
    pushNavigationFrame("detail", detailPath);
    router.push(detailPath);
  }

  async function resolveCatalogLink(targetUrl: string) {
    try {
      const response = await fetch(
        `/api/neodb/catalog-fetch?url=${encodeURIComponent(targetUrl)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            detailPath?: string;
            message?: string | null;
            url?: string;
          }
        | null;

      if (response.status === 302 && (payload?.detailPath || payload?.url)) {
        const href = payload.detailPath || parseCatalogDetailPath(payload.url || "");

        if (href) {
          requestDetailScrollTopForHref(href);
          pushNavigationFrame("detail", href);
          router.push(href);
          return true;
        }
      }

      if (response.status === 202) {
        setCatalogDialog({
          message: t("search.catalogFetch.workingHint"),
          phase: "working",
          skipForm: true,
          url: targetUrl,
        });
        return true;
      }

      navigateToSearch(targetUrl);
      return true;
    } catch {
      navigateToSearch(targetUrl);
      return true;
    }
  }

  function selectFilter(
    filterId: string,
    options: {
      resetMovieSubtab?: boolean;
      swipeDirection?: "left" | "right";
    } = {},
  ) {
    if (options.resetMovieSubtab && filterId === "movie") {
      selectMovieSubtab("trending");
    }

    if (filterId === "collection") {
      selectCollectionSubtab("trending");
    }

    if (filterId === activeFilter) {
      return;
    }

    if (swipeExitTimerRef.current !== null) {
      window.clearTimeout(swipeExitTimerRef.current);
      swipeExitTimerRef.current = null;
    }

    if (options.swipeDirection) {
      setSwipeTransition({
        direction: options.swipeDirection,
        phase: "exit",
      });

      swipeExitTimerRef.current = window.setTimeout(() => {
        swipeExitTimerRef.current = null;
        beginFilterSelection(filterId, {
          swipeDirection: options.swipeDirection,
        });
      }, HOME_SWIPE_EXIT_MS);
      return;
    }

    beginFilterSelection(filterId, options);
  }

  function beginFilterSelection(
    filterId: string,
    options: { swipeDirection?: "left" | "right" } = {},
  ) {
    setDismissPreviewId(null);
    setPendingFilter(filterId);
    window.sessionStorage.setItem(HOME_CATEGORY_KEY, filterId);
    window.sessionStorage.setItem(getHomeScrollKey(filterId), "0");
    setItems([]);
    setVisibleCount(INITIAL_RENDER_COUNT);
    setStatus("loading");
    setError("");

    if (options.swipeDirection) {
      setSwipeTransition({
        direction: options.swipeDirection,
        phase: "enter",
      });
    } else {
      setSwipeTransition(null);
    }

    if (filterId === defaultHomeCategory) {
      router.replace("/");
      return;
    }

    router.replace(`/?category=${encodeURIComponent(filterId)}`);
  }

  function handleContentPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.pointerType === "mouse") {
      return;
    }

    gestureStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleContentPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = gestureStartRef.current;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    gestureStartRef.current = null;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 64 || absX < absY * 1.35) {
      return;
    }

    const activeIndex = filters.findIndex((filter) => filter.id === activeFilter);
    const nextIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
    const nextFilter = filters[nextIndex];

    if (!nextFilter) {
      return;
    }

    suppressGestureClickRef.current = true;
    selectFilter(nextFilter.id, {
      swipeDirection: deltaX < 0 ? "left" : "right",
    });

    window.setTimeout(() => {
      suppressGestureClickRef.current = false;
    }, 0);
  }

  /** The cache key the feed on screen reads and writes. */
  function getActiveFeedCacheKey() {
    return isPersonalHomeTag(activeFilter) && personalFeedScope
      ? getPersonalHomeFeedCacheKey(personalFeedScope, locale)
      : getHomeFeedCacheKey(activeFilter, locale);
  }

  function refreshCurrentFilter() {
    setDismissPreviewId(null);
    clearOtherTrendingCaches(activeFilter, locale);
    window.localStorage.removeItem(getActiveFeedCacheKey());

    window.sessionStorage.setItem(getHomeScrollKey(activeFilter), "0");
    window.scrollTo({ top: 0, behavior: "smooth" });
    setIsRefreshing(true);
    setRefreshRequest({
      category: activeFilter,
      nonce: Date.now(),
    });
  }

  function handleRefreshClick() {
    if (isRefreshUnsupported) {
      showToast(t("home.refreshUnsupported"), "error");
      return;
    }

    refreshCurrentFilter();
  }

  /** Records the dismissal, then reflows the grid in place. No refetch. */
  async function dismissItem(item: HomeCardItem) {
    try {
      const response = await fetch("/api/neodb/dismiss", {
        body: JSON.stringify({ itemId: item.id }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });

      if (response.status === 401) {
        showToast(t("home.dismiss.loginRequired"), "error");
        return false;
      }

      if (!response.ok) {
        showToast(t("home.dismiss.error"), "error");
        return false;
      }
    } catch {
      showToast(t("home.dismiss.error"), "error");
      return false;
    }

    const nextItems = items.filter((candidate) => candidate.id !== item.id);
    const isPersonalActive = isPersonalHomeTag(activeFilter);
    const activeCacheKey = getActiveFeedCacheKey();

    setItems(nextItems);
    setVisibleCount((count) => Math.min(count, nextItems.length));

    // Mirrored into the local record the profile page lists: NeoDB can dismiss
    // and restore an item, but has no endpoint that enumerates dismissals.
    addDismissedItem(item);

    if (isPersonalActive) {
      const withoutItem = (list: HomeCardItem[] | undefined) =>
        (list ?? []).filter((candidate) => candidate.id !== item.id);
      const nextGroups = {
        forYou:
          personalSubtab === "forYou"
            ? nextItems
            : withoutItem(personalFeed?.forYou),
        friends:
          personalSubtab === "friends"
            ? nextItems
            : withoutItem(personalFeed?.friends),
      };

      setPersonalFeed(nextGroups);
      writeCache(activeCacheKey, nextGroups.forYou, nextGroups.friends);
    } else {
      writeCache(activeCacheKey, nextItems);
    }

    // The other rails' cached copies go too, or switching tags brings it back.
    stripDismissedItemFromTrendingCaches(item.id, activeCacheKey);

    setDismissPreviewId(null);
    showToast(t("home.dismiss.toast"));
    return true;
  }

  const contentAnimationClass = getHomeSwipeClass(swipeTransition);
  const isPersonalFeed = isPersonalHomeTag(activeFilter);
  const isCollectionListsView =
    activeFilter === "collection" && collectionSubtab === "lists";
  const isRefreshUnsupported =
    (activeFilter === "movie" && movieSubtab !== "trending") ||
    isCollectionListsView;

  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 pb-32 pt-7 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl">
        <div className="relative z-30 mb-4">
          <form
            className="relative flex h-14 items-center rounded-full border border-white/70 bg-white/60 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-2xl"
            autoComplete="off"
            ref={searchRootRef}
            onSubmit={(event) => {
              event.preventDefault();
              void submitSearch();
            }}
          >
            <SearchScopeSelect
              onChange={setSearchScope}
              options={searchScopes}
              value={searchScope}
            />
            <input
              autoCapitalize="none"
              autoComplete="off"
              autoCorrect="off"
              className="min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-[#75777d]"
              name="app-home-search-query"
              placeholder={t("home.searchPlaceholder")}
              ref={searchInputRef}
              spellCheck={false}
              type="text"
              value={query}
              onChange={(event) => {
                const nextQuery = event.target.value;
                setQuery(nextQuery);

                if (nextQuery.trim()) {
                  setIsHistoryOpen(false);
                  setIsSuggestionsOpen(true);
                } else {
                  setHistoryItems(readSearchHistory());
                  setIsHistoryOpen(true);
                  setIsSuggestionsOpen(false);
                }
              }}
              onFocus={() => {
                setHistoryItems(readSearchHistory());
                if (query.trim()) {
                  setIsSuggestionsOpen(true);
                } else {
                  setIsHistoryOpen(true);
                }
              }}
            />
            {query ? (
              <button
                aria-label={t("home.clearSearch")}
                className="grid size-9 shrink-0 place-items-center rounded-full text-[#75777d] transition hover:bg-white/60 hover:text-[#333e50] press-icon"
                onClick={() => {
                  setQuery("");
                  setHistoryItems(readSearchHistory());
                  setIsHistoryOpen(true);
                  setIsSuggestionsOpen(false);
                  searchInputRef.current?.focus();
                }}
                onMouseDown={(event) => event.preventDefault()}
                type="button"
              >
                <ClearIcon />
              </button>
            ) : null}
            {!query.trim() ? (
              <IsbnScannerButton
                defaultOpen={shortcutAction === "scan-book"}
                key={
                  shortcutAction === "scan-book"
                    ? "shortcut-scanner"
                    : "home-scanner"
                }
                onClose={clearShortcutParam}
                onDetected={(isbn) => {
                  setQuery(isbn);
                  setSearchScope("book");
                  void submitSearch(isbn, "book");
                }}
              />
            ) : null}
            <button
              aria-label={t("home.search")}
              className="grid size-10 place-items-center rounded-full text-[#44474c] transition hover:bg-white/60 hover:text-[#333e50]"
              type="submit"
            >
              <SearchIcon />
            </button>
            {catalogDialog ? (
              <CatalogFetchDialog
                initialMessage={catalogDialog.message}
                initialPhase={catalogDialog.phase}
                initialUrl={catalogDialog.url}
                skipForm={catalogDialog.skipForm}
                onClose={() => setCatalogDialog(null)}
              />
            ) : null}
            {isHistoryOpen && !query.trim() ? (
              <SearchHistoryPopover
                clearLabel={t("search.clearRecentSearches")}
                ignoreRef={searchRootRef}
                items={historyItems}
                title={t("search.recentSearches")}
                onClear={() => {
                  clearSearchHistory();
                  setHistoryItems([]);
                  setIsHistoryOpen(false);
                }}
                onClose={() => setIsHistoryOpen(false)}
                onSelect={(nextQuery) => {
                  setQuery(nextQuery);
                  void submitSearch(nextQuery);
                }}
              />
            ) : null}
            {query.trim() ? (
              <SearchSuggestionsPopover
                category={searchScope}
                onClose={() => setIsSuggestionsOpen(false)}
                onSelect={openSuggestedItem}
                query={query}
                visible={isSuggestionsOpen}
              />
            ) : null}
          </form>
        </div>

        <HorizontalScrollControls
          className="mb-4"
          contentClassName="flex w-max gap-2"
          controlClassName="translate-y-1"
          viewportRef={tagViewportRef}
          viewportClassName="px-10 py-1"
        >
          <button
            aria-disabled={isRefreshUnsupported}
            aria-label={t("home.refreshCategory")}
            className={`grid size-9 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 shadow-sm backdrop-blur transition press-icon disabled:cursor-wait disabled:text-[#a4a6ad] ${
              isRefreshUnsupported
                ? "cursor-not-allowed text-[#a4a6ad]"
                : "text-[#44474c] hover:bg-white/80"
            }`}
            disabled={status === "loading"}
            onClick={handleRefreshClick}
            type="button"
          >
            <span className={isRefreshing ? "animate-spin" : ""}>
              <RefreshIcon />
            </span>
          </button>
          <button
            aria-label={t("profile.appearance.homeTagOrder.button")}
            className="grid size-9 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-[#44474c] shadow-sm backdrop-blur transition hover:bg-white/80 press-icon"
            onClick={() => setIsTagOrderOpen(true)}
            type="button"
          >
            <SortIcon />
          </button>
          {filters.map((filter) => {
            const isActive = filter.id === (pendingFilter || activeFilter);

            return (
              <button
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition ${
                  isActive
                    ? "bg-[#e2e2e5] text-[var(--foreground)]"
                    : "border border-white/70 bg-white/60 text-[#44474c] shadow-sm backdrop-blur hover:bg-white/80"
                }`}
                data-home-filter={filter.id}
                key={filter.id}
                onClick={() =>
                  selectFilter(filter.id, {
                    resetMovieSubtab: filter.id === "movie",
                  })
                }
                type="button"
              >
                {t(`homeTags.${filter.id}`)}
              </button>
            );
          })}
        </HorizontalScrollControls>
        {isTagOrderOpen ? (
          <Suspense fallback={null}>
            <LazyCategoryOrderDialog
              closeLabel={t("profile.appearance.homeTagOrder.close")}
              eventName={HOME_TAG_ORDER_EVENT}
              items={homeTags
                .filter((tag) =>
                  isHomeTagAvailable(tag.id, canUsePersonalFeed),
                )
                .map((tag) => ({
                  id: tag.id,
                  label: t(`homeTags.${tag.id}`),
                }))}
              moveDownLabel={t("profile.appearance.homeTagOrder.moveDown")}
              moveUpLabel={t("profile.appearance.homeTagOrder.moveUp")}
              onClose={() => setIsTagOrderOpen(false)}
              resetLabel={t("profile.appearance.homeTagOrder.resetDefault")}
              storageKey={HOME_TAG_ORDER_KEY}
              title={t("profile.appearance.homeTagOrder.dialogTitle")}
            />
          </Suspense>
        ) : null}

        {isPersonalFeed ? (
          <div className="mb-4 flex items-center gap-1">
            {(["forYou", "friends"] as PersonalSubtab[]).map((subtab) => (
              <button
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  personalSubtab === subtab
                    ? "bg-[#f3f3f6] text-[#44474c]"
                    : "text-[#75777d] hover:bg-[#f3f3f6] hover:text-[#44474c]"
                }`}
                key={subtab}
                onClick={() => selectPersonalSubtab(subtab)}
                type="button"
              >
                {t(`home.forYouSubtab.${subtab}`)}
              </button>
            ))}
          </div>
        ) : null}

        {activeFilter === "movie" && tmdbEnabled ? (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 gap-1">
              {(["trending", "now_playing", "upcoming"] as MovieSubtab[]).map(
                (subtab) => (
                  <button
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                      movieSubtab === subtab
                        ? "bg-[#f3f3f6] text-[#44474c]"
                        : "text-[#75777d] hover:bg-[#f3f3f6] hover:text-[#44474c]"
                    }`}
                    key={subtab}
                    onClick={() => selectMovieSubtab(subtab)}
                    type="button"
                  >
                    {t(
                      `home.movieSubtab.${
                        subtab === "trending"
                          ? "trending"
                          : subtab === "now_playing"
                            ? "nowPlaying"
                            : "upcoming"
                      }`,
                    )}
                  </button>
                ),
              )}
            </div>
            {movieSubtab !== "trending" ? (
              <Dropdown
                ariaLabel={t(`tmdbDiscovery.regions.${tmdbRegion}`)}
                buttonClassName="!h-8 shrink-0 !gap-1.5 !px-2.5"
                maxVisibleOptions={7}
                onChange={changeTmdbRegion}
                options={TMDB_REGIONS.map((code) => ({
                  id: code,
                  label: t(`tmdbDiscovery.regions.${code}`),
                }))}
                triggerLabel={
                  <span className="relative top-px inline-flex items-center gap-1">
                    <GlobeIcon />
                    {tmdbRegion}
                  </span>
                }
                value={tmdbRegion}
              />
            ) : null}
          </div>
        ) : null}

        {activeFilter === "collection" && featuredCollectionsEnabled ? (
          <div className="mb-4 flex items-center justify-between gap-2">
            <div className="flex min-w-0 gap-1">
              {(["trending", "lists"] as CollectionSubtab[]).map((subtab) => (
                <button
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    collectionSubtab === subtab
                      ? "bg-[#f3f3f6] text-[#44474c]"
                      : "text-[#75777d] hover:bg-[#f3f3f6] hover:text-[#44474c]"
                  }`}
                  key={subtab}
                  onClick={() => selectCollectionSubtab(subtab)}
                  type="button"
                >
                  {t(
                    `home.collectionSubtab.${
                      subtab === "trending" ? "trending" : "lists"
                    }`,
                  )}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {activeFilter === "movie" && tmdbEnabled && movieSubtab !== "trending" ? (
          <TmdbMovieRail
            kind={movieSubtab}
            onBeforeNavigate={() => markHomeLeavingForScrollRestore(activeFilter)}
            region={tmdbRegion}
          />
        ) : isCollectionListsView ? (
          <CollectionListsGrid
            contentAnimationClass={contentAnimationClass}
            error={error}
            isCoverProxyEnabled={isCoverProxyEnabled}
            onClickCapture={(event) => {
              if (!suppressGestureClickRef.current) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerCancel={() => {
              gestureStartRef.current = null;
            }}
            onPointerDown={handleContentPointerDown}
            onPointerUp={handleContentPointerUp}
            sections={featuredCollectionSections}
            status={status}
          />
        ) : (
        <div
          className={`touch-pan-y motion-safe:will-change-transform ${contentAnimationClass}`}
          onClickCapture={(event) => {
            if (!suppressGestureClickRef.current) {
              return;
            }

            event.preventDefault();
            event.stopPropagation();
          }}
          onPointerCancel={() => {
            gestureStartRef.current = null;
          }}
          onPointerDown={handleContentPointerDown}
          onPointerUp={handleContentPointerUp}
        >
          {status === "loading" ? <WaterfallSkeleton /> : null}

          {status === "error" ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
              {isPersonalFeed ? t("home.forYou.error") : error}
            </div>
          ) : null}

          {status === "guest" ? (
            <HomeNotice
              action={
                <a
                  className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)]"
                  href="/api/auth/neodb/login"
                >
                  {t("home.forYou.login")}
                </a>
              }
              description={t("home.forYou.guestDescription")}
              title={t("home.forYou.guestTitle")}
            />
          ) : null}

          {status === "ready" && items.length === 0 ? (
            isPersonalFeed ? (
              <HomeNotice
                description={t("home.forYou.emptyDescription")}
                title={t("home.forYou.emptyTitle")}
              />
            ) : (
              <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm text-[#44474c]">
                {t("home.empty")}
              </div>
            )
          ) : null}

          {status === "ready" && items.length > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {items.slice(0, visibleCount).map((item, index) => (
                  <ItemCard
                    activeFilter={activeFilter}
                    index={index}
                    isCoverProxyEnabled={isCoverProxyEnabled}
                    item={item}
                    key={`${item.id}-${index}`}
                    dismissPreviewOpen={dismissPreviewId === item.id}
                    onDismiss={() => dismissItem(item)}
                    onDismissPreviewClose={() => {
                      setDismissPreviewId((current) =>
                        current === item.id ? null : current,
                      );
                    }}
                    onDismissPreviewOpen={() => setDismissPreviewId(item.id)}
                    returnCategory={activeFilter}
                  />
                ))}
              </div>
              {visibleCount < items.length ? (
                <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
              ) : null}
              {visibleCount >= items.length ? (
                <div className="mt-6 text-center text-xs font-semibold text-[#75777d]">
                  {t("home.endOfList")}
                </div>
              ) : null}
            </>
          ) : null}
        </div>
        )}
      </section>
    </main>
  );
}

function centerTagInViewport(viewport: HTMLElement, tag: HTMLElement) {
  viewport.scrollTo({
    behavior: "instant",
    left: tag.offsetLeft + tag.offsetWidth / 2 - viewport.clientWidth / 2,
  });
}

function HomeSkeleton() {
  return (
    <main className="min-h-dvh bg-[var(--background)] px-4 pb-32 pt-7 text-[var(--foreground)]">
      <section className="mx-auto max-w-2xl">
        <div className="mb-4 h-14 rounded-full border border-white/70 bg-white/60 shadow-lg shadow-slate-900/5" />
        <HomeTagRailSkeleton />
        <WaterfallSkeleton />
      </section>
    </main>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M21 12a9 9 0 0 1-15.5 6.2" />
      <path d="M3 12A9 9 0 0 1 18.5 5.8" />
      <path d="M18 2v4h4" />
      <path d="M6 22v-4H2" />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a13.9 13.9 0 0 1 3.5 9 13.9 13.9 0 0 1-3.5 9 13.9 13.9 0 0 1-3.5-9A13.9 13.9 0 0 1 12 3Z" />
    </svg>
  );
}

function ItemCard({
  activeFilter,
  dismissPreviewOpen = false,
  index,
  isCoverProxyEnabled,
  item,
  onDismiss,
  onDismissPreviewClose,
  onDismissPreviewOpen,
  returnCategory,
}: {
  activeFilter: string;
  dismissPreviewOpen?: boolean;
  index: number;
  isCoverProxyEnabled: boolean;
  item: HomeCardItem;
  onDismiss?: () => Promise<boolean>;
  onDismissPreviewClose?: () => void;
  onDismissPreviewOpen?: () => void;
  returnCategory: string;
}) {
  const t = useT();
  const isCollection = item.kind === "collection" || item.category === "collection";
  const canDismiss = Boolean(onDismiss) && !isCollection;
  const isDismissOpen = canDismiss && dismissPreviewOpen;
  const [isDismissing, setIsDismissing] = useState(false);
  if (!isDismissOpen && isDismissing) {
    setIsDismissing(false);
  }
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    return () => {
      if (longPressTimerRef.current !== null) {
        window.clearTimeout(longPressTimerRef.current);
      }
    };
  }, []);

  function cancelLongPress() {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }

    longPressStartRef.current = null;
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (isDismissOpen || !event.isPrimary || event.button !== 0) {
      return;
    }

    longPressStartRef.current = { x: event.clientX, y: event.clientY };
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressStartRef.current = null;
      suppressClickRef.current = true;
      onDismissPreviewOpen?.();
    }, DISMISS_LONG_PRESS_MS);
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = longPressStartRef.current;

    if (!start || longPressTimerRef.current === null) {
      return;
    }

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;

    if (deltaX * deltaX + deltaY * deltaY > DISMISS_LONG_PRESS_MOVE_PX ** 2) {
      cancelLongPress();
    }
  }

  function handleClickCapture(event: MouseEvent<HTMLElement>) {
    const pending = suppressClickRef.current;

    suppressClickRef.current = false;

    if (!pending) {
      return;
    }

    // The release that ends a long press resolves its click target from the
    // touch point at press time — the card link — even though the preview is
    // covering it by then. Only that stale click is swallowed; a real tap on
    // the preview's own controls must go through on the first try.
    if ((event.target as HTMLElement | null)?.closest("[data-dismiss-preview]")) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
  }

  async function confirmDismiss() {
    if (!onDismiss || isDismissing) {
      return;
    }

    setIsDismissing(true);

    const dismissed = await onDismiss();

    if (!dismissed) {
      setIsDismissing(false);
    }
  }

  if (isCollection) {
    const collectionPath = `/collection/${encodeURIComponent(item.id)}`;

    return (
      <article className="group overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 press-card">
        <Link
          className="block"
          href={collectionPath}
          onClick={() => {
            markHomeLeavingForScrollRestore(activeFilter);
            window.sessionStorage.setItem(
              `${COLLECTION_SCROLL_TOP_PREFIX}${item.id}`,
              "1",
            );
            replaceNavigationFrame("root", getHomeHref(activeFilter));
            pushNavigationFrame("detail", collectionPath);
          }}
        >
          <HomeCardVisual
            index={index}
            isCoverProxyEnabled={isCoverProxyEnabled}
            item={item}
          />
        </Link>
      </article>
    );
  }

  const baseDetailPath =
    item.detailPath || `/item/${item.category}/${encodeURIComponent(item.id)}`;
  const detailPath = `${baseDetailPath}?fromCategory=${encodeURIComponent(returnCategory)}`;
  const coverSrc = getCoverProxySrc(item.coverUrl, isCoverProxyEnabled);

  return (
    <article
      className={`group relative overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 ${
        isDismissOpen
          ? ""
          : "transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 press-card"
      } ${canDismiss ? "select-none [-webkit-touch-callout:none]" : ""}`}
      onClickCapture={canDismiss ? handleClickCapture : undefined}
      onContextMenu={
        canDismiss
          ? (event) => {
              event.preventDefault();
            }
          : undefined
      }
      onPointerCancel={canDismiss ? cancelLongPress : undefined}
      onPointerDown={canDismiss ? handlePointerDown : undefined}
      onPointerMove={canDismiss ? handlePointerMove : undefined}
      onPointerUp={canDismiss ? cancelLongPress : undefined}
    >
      <Link
        className="block"
        href={detailPath}
        onClick={() => {
          markHomeLeavingForScrollRestore(activeFilter);
          requestDetailScrollTopForHref(detailPath);
          pushNavigationFrame("detail", detailPath);
        }}
      >
        <HomeCardVisual
          hideTitleCard={isDismissOpen}
          index={index}
          isCoverProxyEnabled={isCoverProxyEnabled}
          item={item}
        />
      </Link>
      {canDismiss && isDismissOpen ? (
        <DismissPreview
          actionLabel={t("home.dismiss.action")}
          busy={isDismissing}
          closeLabel={t("home.dismiss.close")}
          coverSrc={coverSrc}
          onClose={() => {
            if (!isDismissing) {
              onDismissPreviewClose?.();
            }
          }}
          onConfirm={() => void confirmDismiss()}
        />
      ) : null}
    </article>
  );
}

function DismissPreview({
  actionLabel,
  busy,
  closeLabel,
  coverSrc,
  onClose,
  onConfirm,
}: {
  actionLabel: string;
  busy: boolean;
  closeLabel: string;
  coverSrc: string | null;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      className="home-dismiss-enter absolute inset-0 z-20 overflow-hidden rounded-xl"
      data-dismiss-preview=""
      onPointerDown={(event) => event.stopPropagation()}
    >
      {coverSrc ? (
        <>
          <div aria-hidden="true" className="home-dismiss-frost absolute inset-0">
            <Image
              alt=""
              className="object-cover blur-xl"
              decoding="async"
              fill
              quality={75}
              sizes="320px"
              src={coverSrc}
              unoptimized
            />
          </div>
          <div aria-hidden="true" className="home-dismiss-sharp absolute inset-0">
            <Image
              alt=""
              className="object-cover"
              decoding="async"
              fill
              quality={75}
              sizes="320px"
              src={coverSrc}
              unoptimized
            />
          </div>
        </>
      ) : (
        <div className="absolute inset-0 bg-[#b7b8bd]" />
      )}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-b from-black/0 to-black/35" />
      <button
        aria-label={closeLabel}
        className="absolute right-2.5 top-2.5 grid size-8 place-items-center rounded-full border border-white/50 bg-black/35 text-white shadow-sm backdrop-blur-md transition hover:bg-black/50"
        disabled={busy}
        onClick={onClose}
        type="button"
      >
        <ClearIcon />
      </button>
      <div className="absolute inset-x-3 bottom-4">
        <button
          className="w-full rounded-full bg-[var(--theme-primary)] px-4 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] disabled:cursor-wait disabled:opacity-70"
          disabled={busy}
          onClick={onConfirm}
          type="button"
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

function HomeCardVisual({
  hideTitleCard = false,
  index,
  isCoverProxyEnabled,
  item,
}: {
  hideTitleCard?: boolean;
  index: number;
  isCoverProxyEnabled: boolean;
  item: HomeCardItem;
}) {
  const t = useT();
  const coverSrc = getCoverProxySrc(item.coverUrl, isCoverProxyEnabled);
  const isCollection = item.kind === "collection" || item.category === "collection";
  const creatorLabel =
    isCollection ? t("homeTags.collection") : item.creator;

  return (
    <div
      className={`relative aspect-[3/4] ${
        isCollection ? "bg-[#f8f8fa]" : "bg-[#e2e2e5]"
      }`}
    >
      {coverSrc ? (
        <Image
          alt={item.title}
          className={`h-full w-full object-cover ${
            hideTitleCard
              ? ""
              : "transition duration-700 ease-out group-hover:scale-105"
          }`}
          decoding="async"
          fetchPriority={index === 0 ? "high" : "auto"}
          fill
          loading={index < 9 ? "eager" : "lazy"}
          quality={75}
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
          src={coverSrc}
          unoptimized
        />
      ) : (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-[#75777d]">
          {item.title}
        </div>
      )}
      {hideTitleCard ? null : (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 pt-16">
          <div className="translate-y-2 rounded-2xl border border-white/30 bg-white/20 p-2.5 text-white opacity-95 backdrop-blur-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">
              {typeof item.rating === "number" ? (
                <span className="mr-1.5 inline-flex rounded-full border border-white/25 bg-white/35 px-1.5 pt-[3px] pb-0.5 align-[0.125em] text-[10px] font-semibold backdrop-blur-sm">
                  {item.rating.toFixed(1)}
                </span>
              ) : null}
              {item.title}
            </p>
            {creatorLabel ? (
              <p className="mt-1 truncate text-xs text-white/80">
                {creatorLabel}
              </p>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function CollectionListsGrid({
  contentAnimationClass,
  error,
  isCoverProxyEnabled,
  onClickCapture,
  onPointerCancel,
  onPointerDown,
  onPointerUp,
  sections,
  status,
}: {
  contentAnimationClass: string;
  error: string;
  isCoverProxyEnabled: boolean;
  onClickCapture: (event: MouseEvent<HTMLDivElement>) => void;
  onPointerCancel: () => void;
  onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
  sections: FeaturedCollectionSection[];
  status: HomeFeedStatus;
}) {
  return (
    <div
      className={`touch-pan-y space-y-7 pb-4 motion-safe:will-change-transform ${contentAnimationClass}`}
      onClickCapture={onClickCapture}
      onPointerCancel={onPointerCancel}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {status === "loading" ? <WaterfallSkeleton /> : null}

      {status === "error" ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      ) : null}

      {status === "ready"
        ? sections.map((section) => (
            <section className="space-y-3" key={section.id}>
              <div className="min-w-0">
                <h2 className="text-xl font-bold leading-tight text-[var(--foreground)]">
                  {section.title}
                </h2>
              </div>

              <CollectionListRail>
                {section.items.slice(0, 10).map((item, index) => (
                  <ItemCard
                    activeFilter="collection"
                    index={index}
                    isCoverProxyEnabled={isCoverProxyEnabled}
                    item={item}
                    key={`${section.id}-${item.id}-${index}`}
                    returnCategory="collection"
                  />
                ))}
              </CollectionListRail>
            </section>
          ))
        : null}
    </div>
  );
}

function CollectionListRail({ children }: { children: React.ReactNode }) {
  const t = useT();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const viewport = viewportRef.current;

    if (!viewport) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = viewport.scrollWidth - viewport.clientWidth;

    setCanScrollLeft(viewport.scrollLeft > 4);
    setCanScrollRight(viewport.scrollLeft < maxScrollLeft - 4);
  }

  function scrollByDirection(direction: -1 | 1) {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(220, viewport.clientWidth * 0.72),
    });
  }

  useEffect(() => {
    const viewport = viewportRef.current;

    if (!viewport) {
      return;
    }

    updateScrollState();

    const resizeObserver = new ResizeObserver(updateScrollState);

    resizeObserver.observe(viewport);
    viewport.addEventListener("scroll", updateScrollState, { passive: true });

    return () => {
      resizeObserver.disconnect();
      viewport.removeEventListener("scroll", updateScrollState);
    };
  }, [children]);

  return (
    <div className="relative -mx-4 sm:mx-0">
      <div
        className="overflow-x-auto scroll-smooth px-4 pb-2 [scrollbar-width:none] sm:px-0 [&::-webkit-scrollbar]:hidden"
        ref={viewportRef}
      >
        <div className="grid auto-cols-[10.5rem] grid-flow-col gap-4 sm:auto-cols-[12rem]">
          {children}
        </div>
      </div>

      {canScrollLeft ? (
        <button
          aria-label={t("horizontalScroll.scrollLeft")}
          className="absolute left-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/50 text-[#44474c] shadow-lg shadow-slate-900/10 backdrop-blur-2xl transition hover:bg-white/70 press-icon dark:border-white/15 dark:bg-[#2c2c2c]/70 dark:text-[#f1f1f1]"
          onClick={() => scrollByDirection(-1)}
          type="button"
        >
          <CollectionRailChevronIcon direction="left" />
        </button>
      ) : null}

      {canScrollRight ? (
        <button
          aria-label={t("horizontalScroll.scrollRight")}
          className="absolute right-2 top-1/2 z-20 grid size-10 -translate-y-1/2 place-items-center rounded-full border border-white/60 bg-white/50 text-[#44474c] shadow-lg shadow-slate-900/10 backdrop-blur-2xl transition hover:bg-white/70 press-icon dark:border-white/15 dark:bg-[#2c2c2c]/70 dark:text-[#f1f1f1]"
          onClick={() => scrollByDirection(1)}
          type="button"
        >
          <CollectionRailChevronIcon direction="right" />
        </button>
      ) : null}
    </div>
  );
}

function CollectionRailChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      {direction === "left" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}

/** Centred notice for the states a feed can be in before it has cards:
 * signed out, or an empty personal feed. */
function HomeNotice({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-[#e2e2e5] bg-white/70 p-8 text-center">
      <p className="text-base font-bold text-[var(--foreground)]">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-[#44474c]">
          {description}
        </p>
      ) : null}
      {action}
    </div>
  );
}

function WaterfallSkeleton() {
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

function getHomeSwipeClass(transition: SwipeTransition | null) {
  if (!transition) {
    return "";
  }

  if (transition.phase === "exit") {
    return transition.direction === "left"
      ? "home-swipe-exit-left"
      : "home-swipe-exit-right";
  }

  return transition.direction === "left"
    ? "home-swipe-enter-right"
    : "home-swipe-enter-left";
}

function getHomeHref(category: string) {
  if (category === DEFAULT_HOME_CATEGORY) {
    return "/";
  }

  return `/?category=${encodeURIComponent(category)}`;
}

function clearOtherTrendingCaches(activeCategory: string, locale: string) {
  const activeKey = getHomeFeedCacheKey(activeCategory, locale);

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key?.startsWith(HOME_FEED_CACHE_PREFIX) && key !== activeKey) {
      window.localStorage.removeItem(key);
    }
  }
}

function getHomeScrollKey(category: string) {
  return `${HOME_SCROLL_PREFIX}${category}`;
}

function markHomeLeavingForScrollRestore(category: string) {
  window.sessionStorage.setItem(HOME_CATEGORY_KEY, category);
  window.sessionStorage.setItem(
    getHomeScrollKey(category),
    String(window.scrollY),
  );
  window.sessionStorage.setItem(HOME_LEAVING_KEY, "1");
  window.sessionStorage.setItem(HOME_RESTORE_KEY, "1");
}

function clearHomeNavigationMemory() {
  window.sessionStorage.removeItem(HOME_CATEGORY_KEY);
  window.sessionStorage.removeItem(HOME_LEAVING_KEY);
  window.sessionStorage.removeItem(HOME_RESTORE_KEY);

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);

    if (key?.startsWith(HOME_SCROLL_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

function isHomeFilter(value: string, filters: Array<{ id: string }>) {
  return filters.some((filter) => filter.id === value);
}

function readStoredTmdbRegion(locale: Locale) {
  if (typeof window === "undefined") {
    return getDefaultTmdbRegion(locale);
  }

  const stored = window.localStorage.getItem(TMDB_REGION_STORAGE_KEY);

  if (stored && isTmdbRegion(stored)) {
    return stored;
  }

  return getDefaultTmdbRegion(locale);
}

function writeTmdbRegionCookie(region: TmdbRegion) {
  document.cookie = `${TMDB_REGION_COOKIE}=${encodeURIComponent(
    region,
  )}; path=/; max-age=31536000; SameSite=Lax`;
}

function toPersonalGroups(payload: {
  items: HomeCardItem[];
  friendItems?: HomeCardItem[];
}) {
  return { forYou: payload.items, friends: payload.friendItems ?? [] };
}

function readCache(
  key: string,
  options: { allowStale?: boolean } = {},
): CachePayload | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as CachePayload;
    if (!parsed.cachedAt) {
      window.localStorage.removeItem(key);
      return null;
    }

    if (isCacheExpired(parsed) && !options.allowStale) {
      window.localStorage.removeItem(key);
      return null;
    }

    return parsed;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function stripDismissedItemFromTrendingCaches(itemId: string, exceptKey: string) {
  if (typeof window === "undefined") {
    return;
  }

  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (!key?.startsWith(HOME_FEED_CACHE_PREFIX) || key === exceptKey) {
      continue;
    }

    const cached = readCache(key, { allowStale: true });

    if (!cached) {
      continue;
    }

    const holdsItem = [...cached.items, ...(cached.friendItems ?? [])].some(
      (item) => item.id === itemId,
    );

    if (!holdsItem) {
      continue;
    }

    const payload: CachePayload = {
      cachedAt: cached.cachedAt,
      items: cached.items.filter((item) => item.id !== itemId),
      ...(cached.friendItems
        ? {
            friendItems: cached.friendItems.filter((item) => item.id !== itemId),
          }
        : {}),
    };

    window.localStorage.setItem(key, JSON.stringify(payload));
  }
}

function writeCache(
  key: string,
  itemsToCache: HomeCardItem[],
  friendItems?: HomeCardItem[],
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: CachePayload = {
    cachedAt: Date.now(),
    items: itemsToCache,
    ...(friendItems ? { friendItems } : {}),
  };

  window.localStorage.setItem(key, JSON.stringify(payload));
}

function isCacheExpired(payload: CachePayload) {
  return Date.now() - payload.cachedAt > CACHE_TTL;
}
