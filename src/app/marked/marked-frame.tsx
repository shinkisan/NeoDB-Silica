"use client";

import { useInitialListReveal } from "@/components/use-list-motion";
import { useTabSlide } from "@/components/use-tab-slide";
import { trackCategoryIndicator, useSwipePager } from "@/components/use-swipe-pager";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { lazy, Suspense, useEffect, useRef, useState, useTransition } from "react";
import type { ShelfType } from "@/components/mark-badges";
import { HorizontalScrollControls } from "@/components/horizontal-scroll-controls";
import { SortIcon } from "@/components/sort-icon";
import { useT } from "@/components/use-t";
import {
  MARKED_REFRESH_ITEM_EVENT,
  MARKED_REFRESH_ITEM_KEY,
} from "./marked-refresh";
import { MarkedCardsSkeleton } from "./marked-skeleton";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const LazyCategoryOrderDialog = lazy(() =>
  import("@/components/category-order-dialog").then((module) => ({
    default: module.CategoryOrderDialog,
  })),
);

type ShelfFilter = ShelfType;

type MarkedFrameProps = {
  categories: Array<{ id: string; label: string }>;
  category: string;
  children: ReactNode;
  isDataLoading: boolean;
  isRefreshing: boolean;
  onRefresh: () => void;
  orderedCategories: Array<{ id: string; label: string }>;
  shelf: ShelfFilter;
};

const MARKED_RESTORE_KEY = `${STORAGE_PREFIX}v1:marked:restore`;
const MARKED_LEAVING_KEY = `${STORAGE_PREFIX}v1:marked:leaving`;
const MARKED_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:marked:scroll:`;
export const MARKED_CATEGORY_ORDER_EVENT = "app:marked-category-order";
export const MARKED_CATEGORY_ORDER_KEY = `${STORAGE_PREFIX}v1:marked-category-order`;
export const MARKED_LIST_PENDING_EVENT = "app:marked-list-pending";

export function MarkedFrame({
  categories,
  category,
  children,
  isDataLoading,
  isRefreshing,
  onRefresh,
  orderedCategories,
  shelf,
}: MarkedFrameProps) {
  const t = useT();
  const shelfTabs: Array<{ id: ShelfFilter; label: string }> = [
    { id: "wishlist", label: t("marked.shelf.wishlist") },
    { id: "progress", label: t("marked.shelf.progress") },
    { id: "complete", label: t("marked.shelf.complete") },
    { id: "dropped", label: t("marked.shelf.dropped") },
  ];
  const router = useRouter();
  const searchParams = useSearchParams();
  const isRestoringScrollRef = useRef(false);
  const categoryViewportRef = useRef<HTMLDivElement>(null);
  const [pendingTarget, setPendingTarget] = useState<{
    category: string;
    shelf: ShelfFilter;
  } | null>(null);
  const [isExternalPending, setIsExternalPending] = useState(false);
  const [isCategoryOrderOpen, setIsCategoryOrderOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const isWaitingForRoute =
    pendingTarget !== null &&
    (pendingTarget.shelf !== shelf || pendingTarget.category !== category);
  const activeShelf = isWaitingForRoute ? pendingTarget.shelf : shelf;
  const activeCategory = isWaitingForRoute ? pendingTarget.category : category;
  const activeIndex = Math.max(
    0,
    shelfTabs.findIndex((entry) => entry.id === activeShelf),
  );
  const currentSearch = searchParams.toString();
  const showSkeleton =
    isDataLoading || isPending || isWaitingForRoute || isExternalPending;
  const list = useRef<HTMLDivElement>(null);
  const categorySlideRef = useRef<HTMLDivElement>(null);
  const slideCategory = useTabSlide(categorySlideRef);
  useInitialListReveal(list, !showSkeleton, () =>
    Number(searchParams.get("page") || 1) > 1 ||
    isRestoringScrollRef.current || Boolean(window.sessionStorage.getItem(MARKED_RESTORE_KEY)) ||
    document.documentElement.dataset.navDir === "back",
  );
  const activeCategoryIndex = orderedCategories.findIndex((entry) => entry.id === activeCategory);
  const swipeHandlers = useSwipePager({
    index: activeCategoryIndex,
    count: orderedCategories.length,
    onSelect: (index) => goToCategory(orderedCategories[index].id),
    onProgress: (fraction) => trackCategoryIndicator(categoryViewportRef.current, "[data-marked-category]", fraction),
  });

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const viewport = categoryViewportRef.current;
      const activeTag = viewport?.querySelector<HTMLElement>(
        `[data-marked-category="${CSS.escape(activeCategory)}"]`,
      );

      if (viewport && activeTag) {
        centerTagInViewport(viewport, activeTag);
      }
    });

    return () => cancelAnimationFrame(frame);
  }, [activeCategory, orderedCategories]);

  useEffect(() => {
    queueMicrotask(() => setIsExternalPending(false));
  }, [currentSearch]);

  useEffect(() => {
    if (
      pendingTarget &&
      pendingTarget.category === category &&
      pendingTarget.shelf === shelf
    ) {
      queueMicrotask(() => {
        setPendingTarget(null);

      });
    }
  }, [category, pendingTarget, shelf]);

  useEffect(() => {
    function showPendingSkeleton() {
      setIsExternalPending(true);

    }

    window.addEventListener(MARKED_LIST_PENDING_EVENT, showPendingSkeleton);

    return () => {
      window.removeEventListener(MARKED_LIST_PENDING_EVENT, showPendingSkeleton);
    };
  }, []);

  useEffect(() => {
    const itemUuid = window.sessionStorage.getItem(MARKED_REFRESH_ITEM_KEY);

    if (!itemUuid) {
      return;
    }

    window.sessionStorage.removeItem(MARKED_REFRESH_ITEM_KEY);
    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent(MARKED_REFRESH_ITEM_EVENT, {
          detail: { itemUuid },
        }),
      );
    }, 0);
  }, [currentSearch]);

  useEffect(() => {
    if (showSkeleton || window.sessionStorage.getItem(MARKED_RESTORE_KEY) !== "1") {
      return;
    }

    const scrollKey = getMarkedScrollKey(currentSearch);
    const storedScroll = Number(window.sessionStorage.getItem(scrollKey) || "0");

    if (storedScroll <= 0) {
      window.sessionStorage.removeItem(MARKED_RESTORE_KEY);
      window.sessionStorage.removeItem(MARKED_LEAVING_KEY);
      return;
    }

    isRestoringScrollRef.current = true;

    let frame = 0;
    let attempts = 0;
    const startedAt = performance.now();
    const maxDuration = 1400;

    const finish = () => {
      window.sessionStorage.removeItem(MARKED_RESTORE_KEY);
      window.sessionStorage.removeItem(MARKED_LEAVING_KEY);
      isRestoringScrollRef.current = false;
      window.sessionStorage.setItem(scrollKey, String(window.scrollY));
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
  }, [currentSearch, showSkeleton]);

  function goToCategory(nextCategory: string) {
    if (nextCategory === activeCategory) return;
    const href = getMarkedHref({ category: nextCategory, shelf: activeShelf });

    window.sessionStorage.removeItem(MARKED_RESTORE_KEY);
    window.sessionStorage.removeItem(MARKED_LEAVING_KEY);
    window.sessionStorage.setItem(
      getMarkedScrollKey(new URL(href, window.location.origin).search.replace(/^\?/, "")),
      "0",
    );

    setPendingTarget({ category: nextCategory, shelf: activeShelf });

    startTransition(() => {
      router.push(href);
    });
  }

  useEffect(() => {
    function saveScrollPosition() {
      if (
        isRestoringScrollRef.current ||
        window.sessionStorage.getItem(MARKED_LEAVING_KEY) === "1" ||
        window.sessionStorage.getItem(MARKED_RESTORE_KEY) === "1"
      ) {
        return;
      }

      window.sessionStorage.setItem(
        getMarkedScrollKey(window.location.search.replace(/^\?/, "")),
        String(window.scrollY),
      );
    }

    if (window.sessionStorage.getItem(MARKED_RESTORE_KEY) !== "1") {
      saveScrollPosition();
    }

    window.addEventListener("scroll", saveScrollPosition, { passive: true });
    window.addEventListener("pagehide", saveScrollPosition);

    return () => {
      saveScrollPosition();
      window.removeEventListener("scroll", saveScrollPosition);
      window.removeEventListener("pagehide", saveScrollPosition);
    };
  }, [currentSearch]);

  return (
    <>
      <nav className="mx-auto h-[46px] w-full max-w-lg rounded-full border border-white/50 bg-white/55 p-1 shadow-2xl shadow-slate-900/10 backdrop-blur-3xl">
        <div className="relative grid h-9 grid-cols-4">
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/4 rounded-full bg-[var(--theme-primary)] shadow-md motion-pill transition-transform duration-(--dur-spring) ease-spring-snappy"
            style={{ transform: `translateX(${activeIndex * 100}%)` }}
          />
          {shelfTabs.map((entry, index) => {
            const isActive = entry.id === activeShelf;

            return (
              <button
                className={`relative z-10 grid h-9 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${
                  isActive ? "text-white" : "text-[#44474c]"
                }`}
                key={entry.id}
                onClick={() => {
                  if (entry.id === activeShelf) {
                    return;
                  }

                  const href = getMarkedHref({
                    category: activeCategory,
                    shelf: entry.id,
                  });
                  window.sessionStorage.removeItem(MARKED_RESTORE_KEY);
                  window.sessionStorage.removeItem(MARKED_LEAVING_KEY);
                  window.sessionStorage.setItem(
                    getMarkedScrollKey(new URL(href, window.location.origin).search.replace(/^\?/, "")),
                    "0",
                  );
                  slideCategory(index - activeIndex, () => {
                    setPendingTarget({
                      category: activeCategory,
                      shelf: entry.id,
                    });
                    startTransition(() => {
                      router.push(href);
                    });
                  });
                }}
                type="button"
              >
                {entry.label}
              </button>
            );
          })}
        </div>
      </nav>
      <HorizontalScrollControls
        className="w-full"
        contentClassName="flex w-max gap-2"
        controlClassName="translate-y-1"
        viewportRef={categoryViewportRef}
        viewportClassName="px-10 py-1"
      >
        <button
          aria-label={t("home.refreshCategory")}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-[#44474c] shadow-sm transition hover:bg-white/80 press-icon disabled:cursor-wait disabled:text-[#a4a6ad]"
          disabled={isDataLoading}
          onClick={onRefresh}
          type="button"
        >
          <span className={isRefreshing ? "animate-spin" : ""}>
            <RefreshIcon />
          </span>
        </button>
        <button
          aria-label={t("profile.appearance.homeTagOrder.button")}
          className="grid size-8 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-[#44474c] shadow-sm transition hover:bg-white/80 press-icon"
          onClick={() => setIsCategoryOrderOpen(true)}
          type="button"
        >
          <SortIcon />
        </button>
        {orderedCategories.map((entry, index) => (
          <button
            aria-pressed={entry.id === activeCategory}
            className={`motion-category relative isolate shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              entry.id === activeCategory
                ? "text-[var(--foreground)]"
                : "border border-white/70 bg-white/60 text-[#44474c] shadow-sm hover:bg-white/80"
            }`}
            data-marked-category={entry.id}
            key={entry.id}
            onClick={() => {
              if (entry.id !== activeCategory) slideCategory(index - activeCategoryIndex, () => goToCategory(entry.id));
            }}
            type="button"
          >
            {entry.label}
          </button>
        ))}
      </HorizontalScrollControls>
      {isCategoryOrderOpen ? (
        <Suspense fallback={null}>
          <LazyCategoryOrderDialog
            closeLabel={t("profile.appearance.homeTagOrder.close")}
            eventName={MARKED_CATEGORY_ORDER_EVENT}
            items={categories}
            moveDownLabel={t("profile.appearance.homeTagOrder.moveDown")}
            moveUpLabel={t("profile.appearance.homeTagOrder.moveUp")}
            onClose={() => setIsCategoryOrderOpen(false)}
            resetLabel={t("profile.appearance.homeTagOrder.resetDefault")}
            storageKey={MARKED_CATEGORY_ORDER_KEY}
            title={t("marked.categoryOrderTitle")}
          />
        </Suspense>
      ) : null}
      <div className="tab-slide" ref={categorySlideRef}>
        <div
          className="min-h-[50dvh] touch-pan-y"
          ref={list}
          {...swipeHandlers}
        >
          {showSkeleton ? <MarkedCardsSkeleton /> : children}
        </div>
      </div>
    </>
  );
}

function centerTagInViewport(viewport: HTMLElement, tag: HTMLElement) {
  viewport.scrollTo({
    behavior: "instant",
    left: tag.offsetLeft + tag.offsetWidth / 2 - viewport.clientWidth / 2,
  });
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

export function sortCategories(
  categories: Array<{ id: string; label: string }>,
  value: unknown,
) {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const knownIds = new Set(categories.map((entry) => entry.id));
  const orderedIds = ids.filter(
    (id, index) => knownIds.has(id) && ids.indexOf(id) === index,
  );
  const missingIds = categories
    .map((entry) => entry.id)
    .filter((id) => !orderedIds.includes(id));

  return [...orderedIds, ...missingIds]
    .map((id) => categories.find((entry) => entry.id === id))
    .filter((entry): entry is { id: string; label: string } => Boolean(entry));
}

function getMarkedHref({
  category,
  shelf,
}: {
  category: string;
  shelf: ShelfFilter;
}) {
  // Always set explicitly, even for "all": which category is the default
  // depends on the user's saved tag order, so omitting it here can't safely
  // be read as "the default" by whatever later reads the URL.
  const params = new URLSearchParams({ category, shelf });

  return `/marked?${params.toString()}`;
}

function getMarkedScrollKey(search: string) {
  return `${MARKED_SCROLL_PREFIX}${search || "default"}`;
}
