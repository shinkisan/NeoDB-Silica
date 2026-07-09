"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { showToast } from "@/components/app-toast";
import { ActivityCardList } from "@/components/activity-card";
import { useT } from "@/components/use-t";
import {
  readActiveFollowingTimelineCache,
  readActivePublicTimelineCache,
  readActiveTimelineCache,
  updateFollowingTimelineCache,
  updatePublicTimelineCache,
  writeFollowingTimelineCache,
  writePublicTimelineCache,
  writeTimelineCache,
} from "@/lib/timeline-cache";
import { BackToTopButton } from "@/components/back-to-top";
import { readLastSeenNotificationId } from "@/lib/notification-read-state";
import { TimelineListSkeleton } from "./timeline-skeleton";
import type {
  TimelineResponse,
  TimelineStatus,
  TimelineView,
} from "./timeline-types";

const views: TimelineView[] = ["public", "following", "mine"];
const TIMELINE_RESTORE_KEY = "bielu:v1:timeline:restore";
const TIMELINE_SCROLL_KEY = "bielu:v1:timeline:scroll";

// `performance.navigation` reflects how the current document was loaded and is
// constant for its lifetime, so reload detection must run once per document —
// not on every SPA remount, which would clobber scroll restoration on
// legitimate back-navigation. On a hard refresh we drop the saved scroll so the
// timeline starts at the top instead of restoring a stale position.
let didHandleTimelineReload = false;

function handleTimelineReload() {
  if (didHandleTimelineReload || typeof window === "undefined") {
    return;
  }

  didHandleTimelineReload = true;
  const navEntry = performance.getEntriesByType?.("navigation")?.[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navEntry?.type === "reload") {
    window.sessionStorage.removeItem(TIMELINE_RESTORE_KEY);
    window.sessionStorage.removeItem(TIMELINE_SCROLL_KEY);
  }
}
const PULL_REFRESH_TRIGGER_PX = 68;
const PULL_REFRESH_MAX_PX = 96;
const WHEEL_PULL_DISTANCE_FACTOR = 0.2;
const TIMELINE_SWIPE_EXIT_MS = 160;
type TimelineLoadState = "idle" | "loading" | "ready" | "guest" | "error";
type SwipeTransition = {
  direction: "left" | "right";
  phase: "enter" | "exit";
};

export function TimelinePage() {
  const t = useT();
  const searchParams = useSearchParams();
  const [activeView, setActiveView] = useState<TimelineView>(() =>
    normalizeTimelineView(searchParams.get("view")),
  );
  const [statuses, setStatuses] = useState<TimelineStatus[]>([]);
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<
    "loading" | "ready" | "guest" | "error"
  >("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [publicStatuses, setPublicStatuses] = useState<TimelineStatus[]>([]);
  const [publicState, setPublicState] = useState<TimelineLoadState>("idle");
  const [followingStatuses, setFollowingStatuses] = useState<TimelineStatus[]>([]);
  const [followingNextMaxId, setFollowingNextMaxId] = useState<string | null>(null);
  const [followingHasMore, setFollowingHasMore] = useState(false);
  const [followingState, setFollowingState] = useState<TimelineLoadState>("idle");
  const [isLoadingMoreFollowing, setIsLoadingMoreFollowing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const [swipeTransition, setSwipeTransition] =
    useState<SwipeTransition | null>(null);
  const mainRef = useRef<HTMLElement>(null);
  const cacheScopeRef = useRef<string | null>(null);
  const publicCacheScopeRef = useRef<string | null>(null);
  const followingCacheScopeRef = useRef<string | null>(null);
  const hasRestoredScrollRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const pullDistanceRef = useRef(0);
  const refreshActiveTimelineRef = useRef<() => Promise<void>>(async () => {});
  const swipeExitTimerRef = useRef<number | null>(null);
  const swipeGestureRef = useRef<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressGestureClickRef = useRef(false);
  const canPullRefreshRef = useRef(false);
  const activeIndex = views.indexOf(activeView);
  const contentAnimationClass = getTimelineSwipeClass(swipeTransition);
  const notificationsHref = `/timeline/notifications?from=${encodeURIComponent(
    getTimelineViewHref(activeView),
  )}`;

  useEffect(() => {
    const documentOverscroll = document.documentElement.style.overscrollBehaviorY;
    const bodyOverscroll = document.body.style.overscrollBehaviorY;

    document.documentElement.style.overscrollBehaviorY = "none";
    document.body.style.overscrollBehaviorY = "none";

    return () => {
      document.documentElement.style.overscrollBehaviorY = documentOverscroll;
      document.body.style.overscrollBehaviorY = bodyOverscroll;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (swipeExitTimerRef.current !== null) {
        window.clearTimeout(swipeExitTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    refreshActiveTimelineRef.current = refreshActiveTimeline;
  });

  useEffect(() => {
    let cancelled = false;

    async function checkUnreadNotifications() {
      try {
        const response = await fetch("/api/neodb/notifications");
        if (!response.ok) return;

        const payload = (await response.json()) as {
          notifications?: Array<{ id?: string }>;
        };
        const latestId = payload.notifications?.[0]?.id || "";

        if (!cancelled) {
          setHasUnreadNotifications(
            Boolean(latestId && latestId !== readLastSeenNotificationId()),
          );
        }
      } catch {
        // Keep the notification entry quiet if the check fails.
      }
    }

    void checkUnreadNotifications();

    return () => {
      cancelled = true;
    };
  }, []);

  const currentViewState =
    activeView === "public" ? publicState
    : activeView === "following" ? followingState
    : state;
  useEffect(() => {
    canPullRefreshRef.current = currentViewState === "ready";
  }, [currentViewState]);

  useEffect(() => {
    const element = mainRef.current;
    if (!element) return;

    let gesture: {
      claimed: boolean;
      startX: number;
      startY: number;
    } | null = null;
    let wheelEndTimer: number | null = null;

    function resetGesture() {
      gesture = null;
      if (wheelEndTimer !== null) {
        window.clearTimeout(wheelEndTimer);
        wheelEndTimer = null;
      }
      setIsPulling(false);
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }

    function handleTouchStart(event: globalThis.TouchEvent) {
      if (
        !canPullRefreshRef.current ||
        isRefreshingRef.current ||
        window.scrollY > 0 ||
        event.touches.length !== 1
      ) {
        return;
      }

      gesture = {
        claimed: false,
        startX: event.touches[0].clientX,
        startY: event.touches[0].clientY,
      };
    }

    function handleTouchMove(event: globalThis.TouchEvent) {
      if (!gesture || event.touches.length !== 1) return;

      const deltaX = event.touches[0].clientX - gesture.startX;
      const deltaY = event.touches[0].clientY - gesture.startY;

      if (deltaY <= 0 || window.scrollY > 0) {
        resetGesture();
        return;
      }

      if (!gesture.claimed) {
        if (deltaY < 8) return;
        if (Math.abs(deltaX) >= deltaY) {
          resetGesture();
          return;
        }
        gesture.claimed = true;
        setIsPulling(true);
      }

      event.preventDefault();
      const distance = Math.min(PULL_REFRESH_MAX_PX, deltaY * 0.55);
      pullDistanceRef.current = distance;
      setPullDistance(distance);
    }

    function handleTouchEnd() {
      const shouldRefresh =
        Boolean(gesture?.claimed) &&
        pullDistanceRef.current >= PULL_REFRESH_TRIGGER_PX;

      gesture = null;
      setIsPulling(false);

      if (shouldRefresh) {
        void refreshActiveTimelineRef.current();
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    }

    function finishWheelGesture() {
      wheelEndTimer = null;
      setIsPulling(false);

      if (pullDistanceRef.current >= PULL_REFRESH_TRIGGER_PX) {
        void refreshActiveTimelineRef.current();
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    }

    function handleWheel(event: WheelEvent) {
      if (
        event.ctrlKey ||
        isRefreshingRef.current ||
        window.scrollY > 0 ||
        Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ) {
        return;
      }

      if (event.deltaY >= 0) {
        if (pullDistanceRef.current > 0) resetGesture();
        return;
      }

      event.preventDefault();
      setIsPulling(true);

      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? window.innerHeight
            : 1;
      const distance = Math.min(
        PULL_REFRESH_MAX_PX,
        pullDistanceRef.current +
          Math.abs(event.deltaY) * unit * WHEEL_PULL_DISTANCE_FACTOR,
      );
      pullDistanceRef.current = distance;
      setPullDistance(distance);

      if (wheelEndTimer !== null) window.clearTimeout(wheelEndTimer);
      wheelEndTimer = window.setTimeout(finishWheelGesture, 140);
    }

    element.addEventListener("touchstart", handleTouchStart, { passive: true });
    element.addEventListener("touchmove", handleTouchMove, { passive: false });
    element.addEventListener("touchend", handleTouchEnd, { passive: true });
    element.addEventListener("touchcancel", handleTouchEnd, { passive: true });
    element.addEventListener("wheel", handleWheel, { passive: false });

    return () => {
      if (wheelEndTimer !== null) window.clearTimeout(wheelEndTimer);
      element.removeEventListener("touchstart", handleTouchStart);
      element.removeEventListener("touchmove", handleTouchMove);
      element.removeEventListener("touchend", handleTouchEnd);
      element.removeEventListener("touchcancel", handleTouchEnd);
      element.removeEventListener("wheel", handleWheel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readActiveTimelineCache<TimelineResponse>();

    if (cached) {
      cacheScopeRef.current = cached.scope;
      applyTimelinePayload(cached.payload, {
        setHasMore,
        setNextMaxId,
        setStatuses,
      });
      setState("ready");
      // Keep a stale cache as-is here; it is refreshed with the spinner widget
      // once the mine tab becomes the active view (see the tab-activation
      // effect below), instead of silently swapping in behind another tab.
      return;
    }

    async function loadTimeline() {
      try {
        const response = await fetch("/api/neodb/timeline");

        if (response.status === 401) {
          if (!cancelled) setState("guest");
          return;
        }

        if (!response.ok) {
          throw new Error("timeline fetch failed");
        }

        const payload = (await response.json()) as TimelineResponse;

        if (!cancelled) {
          cacheScopeRef.current = payload.cacheScope;
          applyTimelinePayload(payload, {
            setHasMore,
            setNextMaxId,
            setStatuses,
          });
          writeTimelineCache(payload.cacheScope, payload);
          setState("ready");
        }
      } catch {
        if (!cancelled && !cached) setState("error");
      }
    }

    loadTimeline();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (activeView !== "public" || publicState !== "idle") return;

    const cached = readActivePublicTimelineCache<TimelineResponse>();
    if (cached) {
      publicCacheScopeRef.current = cached.scope;
      setPublicStatuses(cached.payload.statuses);
      setPublicState("ready");
      // A stale cache is refreshed with the spinner widget by the
      // tab-activation effect below rather than silently here.
      return;
    }

    void loadPublicTimeline(false);
  }, [activeView, publicState]);

  useEffect(() => {
    if (activeView !== "following" || followingState !== "idle") return;

    const cached = readActiveFollowingTimelineCache<TimelineResponse>();
    if (cached) {
      followingCacheScopeRef.current = cached.scope;
      applyTimelinePayload(cached.payload, {
        setHasMore: setFollowingHasMore,
        setNextMaxId: setFollowingNextMaxId,
        setStatuses: setFollowingStatuses,
      });
      setFollowingState("ready");
      // A stale cache is refreshed with the spinner widget by the
      // tab-activation effect below rather than silently here.
      return;
    }

    void loadFollowingTimeline(false);
  }, [activeView, followingState]);

  // When a timeline becomes the active view with stale cached content already
  // on screen, refresh it through the pull-to-refresh flow so the update
  // surfaces the spinner widget instead of a silent swap after a delay.
  useEffect(() => {
    if (activeView === "public") {
      if (publicState !== "ready") return;
      const cached = readActivePublicTimelineCache<TimelineResponse>();
      if (cached?.isExpired) {
        void refreshActiveTimelineRef.current();
      }
    } else if (activeView === "mine") {
      if (state !== "ready") return;
      const cached = readActiveTimelineCache<TimelineResponse>();
      if (cached && (cached.isDirty || cached.isExpired)) {
        void refreshActiveTimelineRef.current();
      }
    } else if (activeView === "following") {
      if (followingState !== "ready") return;
      const cached = readActiveFollowingTimelineCache<TimelineResponse>();
      if (cached && (cached.isDirty || cached.isExpired)) {
        void refreshActiveTimelineRef.current();
      }
    }
  }, [activeView, followingState, publicState, state]);

  useEffect(() => {
    handleTimelineReload();
  }, []);

  useEffect(() => {
    const isActiveViewReady =
      activeView === "public"
        ? publicState === "ready"
        : activeView === "following"
          ? followingState === "ready"
          : state === "ready";

    if (
      !isActiveViewReady ||
      hasRestoredScrollRef.current ||
      window.sessionStorage.getItem(TIMELINE_RESTORE_KEY) !== "1"
    ) {
      return;
    }

    hasRestoredScrollRef.current = true;
    const scrollY = Number(window.sessionStorage.getItem(TIMELINE_SCROLL_KEY) || 0);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ behavior: "instant", top: Math.max(0, scrollY) });
        window.sessionStorage.removeItem(TIMELINE_RESTORE_KEY);
      });
    });
  }, [
    activeView,
    followingState,
    followingStatuses.length,
    publicState,
    publicStatuses.length,
    state,
    statuses.length,
  ]);

  async function loadMore() {
    if (!nextMaxId || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({ maxId: nextMaxId });
      const response = await fetch(`/api/neodb/timeline?${params.toString()}`);
      if (!response.ok) throw new Error("timeline fetch failed");

      const payload = (await response.json()) as TimelineResponse;
      setStatuses((current) => {
        const nextStatuses = mergeStatuses(current, payload.statuses);
        writeTimelineCache(payload.cacheScope, {
          ...payload,
          statuses: nextStatuses,
        });
        return nextStatuses;
      });
      cacheScopeRef.current = payload.cacheScope;
      setNextMaxId(payload.nextMaxId);
      setHasMore(payload.hasMore);
    } catch {
      // Keep the current timeline. The persistent retry control remains available.
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function loadMoreFollowing() {
    if (!followingNextMaxId || isLoadingMoreFollowing) return;

    setIsLoadingMoreFollowing(true);
    try {
      const params = new URLSearchParams({
        maxId: followingNextMaxId,
        view: "following",
      });
      const response = await fetch(`/api/neodb/timeline?${params.toString()}`);
      if (!response.ok) throw new Error("following timeline fetch failed");

      const payload = (await response.json()) as TimelineResponse;
      setFollowingStatuses((current) => {
        const nextStatuses = mergeStatuses(current, payload.statuses);
        writeFollowingTimelineCache(payload.cacheScope, {
          ...payload,
          statuses: nextStatuses,
        });
        return nextStatuses;
      });
      followingCacheScopeRef.current = payload.cacheScope;
      setFollowingNextMaxId(payload.nextMaxId);
      setFollowingHasMore(payload.hasMore);
    } catch {
      // Keep the current timeline and its retry control available.
    } finally {
      setIsLoadingMoreFollowing(false);
    }
  }

  const updateStatus = useCallback(
    (postId: string, update: (status: TimelineStatus) => TimelineStatus) => {
      setPublicStatuses((current) => {
        const nextStatuses = current.map((status) =>
          status.id === postId ? update(status) : status,
        );
        const scope = publicCacheScopeRef.current;

        if (scope) {
          updatePublicTimelineCache<TimelineResponse>(scope, (payload) => ({
            ...payload,
            statuses: nextStatuses,
          }));
        }

        return nextStatuses;
      });
      setFollowingStatuses((current) => {
        const nextStatuses = current.map((status) =>
          status.id === postId ? update(status) : status,
        );
        const scope = followingCacheScopeRef.current;

        if (scope) {
          updateFollowingTimelineCache<TimelineResponse>(scope, (payload) => ({
            ...payload,
            statuses: nextStatuses,
          }));
        }

        return nextStatuses;
      });
      setStatuses((current) => {
        const nextStatuses = current.map((status) =>
          status.id === postId ? update(status) : status,
        );
        const scope = cacheScopeRef.current;

        if (scope) {
          writeTimelineCache(scope, {
            cacheScope: scope,
            hasMore,
            nextMaxId,
            statuses: nextStatuses,
          } satisfies TimelineResponse);
        }

        return nextStatuses;
      });
    },
    [hasMore, nextMaxId],
  );

  const deleteStatus = useCallback(
    (postId: string) => {
      setPublicStatuses((current) => {
        const nextStatuses = current.filter((status) => status.id !== postId);
        const scope = publicCacheScopeRef.current;

        if (scope) {
          updatePublicTimelineCache<TimelineResponse>(scope, (payload) => ({
            ...payload,
            statuses: nextStatuses,
          }));
        }

        return nextStatuses;
      });
      setFollowingStatuses((current) => {
        const nextStatuses = current.filter((status) => status.id !== postId);
        const scope = followingCacheScopeRef.current;

        if (scope) {
          updateFollowingTimelineCache<TimelineResponse>(scope, (payload) => ({
            ...payload,
            statuses: nextStatuses,
          }));
        }

        return nextStatuses;
      });
      setStatuses((current) => {
        const nextStatuses = current.filter((status) => status.id !== postId);
        const scope = cacheScopeRef.current;

        if (scope) {
          writeTimelineCache(scope, {
            cacheScope: scope,
            hasMore,
            nextMaxId,
            statuses: nextStatuses,
          } satisfies TimelineResponse);
        }

        return nextStatuses;
      });
    },
    [hasMore, nextMaxId],
  );

  async function loadPublicTimeline(hasCachedContent = false) {
    if (!hasCachedContent) setPublicState("loading");
    try {
      const params = new URLSearchParams({ view: "public" });
      const response = await fetch(`/api/neodb/timeline?${params.toString()}`);

      if (response.status === 401) {
        if (!hasCachedContent) setPublicState("guest");
        return;
      }

      if (!response.ok) throw new Error("public timeline fetch failed");

      const payload = (await response.json()) as TimelineResponse;
      const scope = payload.cacheScope ?? "public";
      publicCacheScopeRef.current = scope;
      setPublicStatuses(payload.statuses);
      writePublicTimelineCache(scope, payload);
      setPublicState("ready");
    } catch {
      if (!hasCachedContent) setPublicState("error");
    }
  }

  async function loadFollowingTimeline(hasCachedContent = false) {
    if (!hasCachedContent) setFollowingState("loading");

    try {
      const params = new URLSearchParams({ view: "following" });
      const response = await fetch(`/api/neodb/timeline?${params.toString()}`);

      if (response.status === 401) {
        if (!hasCachedContent) setFollowingState("guest");
        return;
      }

      if (!response.ok) throw new Error("following timeline fetch failed");

      const payload = (await response.json()) as TimelineResponse;
      followingCacheScopeRef.current = payload.cacheScope;
      applyTimelinePayload(payload, {
        setHasMore: setFollowingHasMore,
        setNextMaxId: setFollowingNextMaxId,
        setStatuses: setFollowingStatuses,
      });
      writeFollowingTimelineCache(payload.cacheScope, payload);
      setFollowingState("ready");
    } catch {
      if (!hasCachedContent) setFollowingState("error");
    }
  }

  async function refreshActiveTimeline() {
    if (isRefreshingRef.current) return;

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    pullDistanceRef.current = 48;
    setPullDistance(48);

    try {
      const params = new URLSearchParams();
      if (activeView !== "mine") params.set("view", activeView);
      const query = params.size > 0 ? `?${params.toString()}` : "";
      const response = await fetch(`/api/neodb/timeline${query}`);

      if (!response.ok) throw new Error("timeline refresh failed");

      const payload = (await response.json()) as TimelineResponse;

      if (activeView === "public") {
        const publicScope = payload.cacheScope ?? "public";
        publicCacheScopeRef.current = publicScope;
        setPublicStatuses(payload.statuses);
        setPublicState("ready");
        writePublicTimelineCache(publicScope, payload);
      } else if (activeView === "following") {
        followingCacheScopeRef.current = payload.cacheScope;
        applyTimelinePayload(payload, {
          setHasMore: setFollowingHasMore,
          setNextMaxId: setFollowingNextMaxId,
          setStatuses: setFollowingStatuses,
        });
        setFollowingState("ready");
        writeFollowingTimelineCache(payload.cacheScope, payload);
      } else {
        cacheScopeRef.current = payload.cacheScope;
        applyTimelinePayload(payload, {
          setHasMore,
          setNextMaxId,
          setStatuses,
        });
        setState("ready");
        writeTimelineCache(payload.cacheScope, payload);
      }
    } catch {
      showToast(t("timeline.refreshError"), "error");
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      pullDistanceRef.current = 0;
      setPullDistance(0);
    }
  }

  function selectTimelineView(
    view: TimelineView,
    options: { swipeDirection?: "left" | "right" } = {},
  ) {
    if (view === activeView) return;

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
        window.scrollTo({ top: 0, behavior: "instant" });
        setActiveView(view);
        updateTimelineViewUrl(view);
        setSwipeTransition({
          direction: options.swipeDirection!,
          phase: "enter",
        });
      }, TIMELINE_SWIPE_EXIT_MS);
      return;
    }

    window.scrollTo({ top: 0, behavior: "instant" });
    setSwipeTransition(null);
    setActiveView(view);
    updateTimelineViewUrl(view);
  }

  function handleContentPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (!event.isPrimary || event.pointerType === "mouse") return;

    swipeGestureRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleContentPointerUp(event: PointerEvent<HTMLDivElement>) {
    const start = swipeGestureRef.current;
    if (!start || start.id !== event.pointerId) return;

    swipeGestureRef.current = null;
    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 64 || absX < absY * 1.35) return;

    const nextIndex = deltaX < 0 ? activeIndex + 1 : activeIndex - 1;
    const nextView = views[nextIndex];
    if (!nextView) return;

    suppressGestureClickRef.current = true;
    selectTimelineView(nextView, {
      swipeDirection: deltaX < 0 ? "left" : "right",
    });
    window.setTimeout(() => {
      suppressGestureClickRef.current = false;
    }, 0);
  }

  return (
    <main
      className="relative min-h-dvh overflow-x-clip bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)] lg:pl-32 lg:pr-8"
      ref={mainRef}
    >
      <section className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="mx-auto flex h-[46px] w-full max-w-lg items-center gap-2 sm:relative sm:block sm:max-w-none">
          <nav className="h-[46px] min-w-0 flex-1 rounded-full border border-white/50 bg-white/55 p-1 shadow-2xl shadow-slate-900/10 backdrop-blur-3xl sm:mx-auto sm:w-full sm:max-w-lg">
            <div className="relative grid h-9 grid-cols-3">
              <span
                aria-hidden="true"
                className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-[var(--theme-primary)] shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${activeIndex * 100}%)` }}
              />
              {views.map((view) => (
                <button
                  aria-current={activeView === view ? "page" : undefined}
                  className={`relative z-10 grid h-9 place-items-center rounded-full text-xs font-bold transition-colors duration-300 ${
                    activeView === view ? "text-white" : "text-[#44474c]"
                  }`}
                  key={view}
                  onClick={() => {
                    selectTimelineView(view);
                  }}
                  type="button"
                >
                  {t(`timeline.tabs.${view}`)}
                </button>
              ))}
            </div>
          </nav>
          <Link
            aria-label={t("notifications.title")}
            className="relative grid size-[46px] shrink-0 place-items-center rounded-full border border-white/50 bg-white/55 text-[#44474c] shadow-[0_14px_28px_rgba(15,23,42,0.08)] backdrop-blur-3xl transition hover:bg-white/75 hover:text-[var(--foreground)] active:scale-95 sm:absolute sm:right-0 sm:top-0"
            href={notificationsHref}
          >
            <BellIcon />
            {hasUnreadNotifications ? (
              <span
                aria-hidden="true"
                className="absolute right-3 top-3 size-2 rounded-full bg-[#ff4f7a] shadow-sm shadow-[#ff4f7a]/40"
              />
            ) : null}
          </Link>
        </div>

        <div className="relative min-h-[55dvh]">
          <PullRefreshIndicator
            distance={pullDistance}
            isRefreshing={isRefreshing}
          />
          <div
            className={`touch-pan-y motion-safe:will-change-transform ${contentAnimationClass}`}
            onClickCapture={(event) => {
              if (!suppressGestureClickRef.current) return;
              event.preventDefault();
              event.stopPropagation();
            }}
            onPointerCancel={() => {
              swipeGestureRef.current = null;
            }}
            onPointerDown={handleContentPointerDown}
            onPointerUp={handleContentPointerUp}
            style={{
              transform: `translateY(${pullDistance}px)`,
              transition: isPulling ? "none" : "transform 180ms ease-out",
            }}
          >
            {activeView === "public" ? (
              <PublicTimeline
                onDelete={deleteStatus}
                state={publicState}
                statuses={publicStatuses}
                updateStatus={updateStatus}
              />
            ) : activeView === "following" ? (
              <FollowingTimeline
                hasMore={followingHasMore}
                isLoadingMore={isLoadingMoreFollowing}
                loadMore={loadMoreFollowing}
                onDelete={deleteStatus}
                state={followingState}
                statuses={followingStatuses}
                updateStatus={updateStatus}
              />
            ) : (
              <MineTimeline
                hasMore={hasMore}
                isLoadingMore={isLoadingMore}
                loadMore={loadMore}
                onDelete={deleteStatus}
                state={state}
                statuses={statuses}
                updateStatus={updateStatus}
              />
            )}
          </div>
        </div>
      </section>
      <BackToTopButton />
    </main>
  );
}

function PullRefreshIndicator({
  distance,
  isRefreshing,
}: {
  distance: number;
  isRefreshing: boolean;
}) {
  const t = useT();
  const progress = Math.min(1, distance / PULL_REFRESH_TRIGGER_PX);

  return (
    <div
      aria-hidden={!isRefreshing}
      aria-label={isRefreshing ? t("timeline.refreshing") : undefined}
      className="pointer-events-none absolute left-1/2 z-20 grid size-9 place-items-center rounded-full border border-white/70 bg-white/70 text-[#75777d] shadow-md shadow-slate-900/10 backdrop-blur-2xl"
      role={isRefreshing ? "status" : undefined}
      style={{
        opacity: isRefreshing ? 1 : progress,
        top: `${(distance - 60) / 2}px`,
        transform: `translateX(-50%) scale(${0.75 + progress * 0.25})`,
      }}
    >
      <RefreshIcon
        className={isRefreshing ? "animate-spin" : ""}
        rotation={progress * 180}
      />
    </div>
  );
}

function PublicTimeline({
  onDelete,
  state,
  statuses,
  updateStatus,
}: {
  onDelete: (postId: string) => void;
  state: TimelineLoadState;
  statuses: TimelineStatus[];
  updateStatus: (
    postId: string,
    update: (status: TimelineStatus) => TimelineStatus,
  ) => void;
}) {
  const t = useT();

  if (state === "idle" || state === "loading") {
    return <TimelineListSkeleton />;
  }

  if (state === "guest") {
    return (
      <TimelineEmptyState
        action={
          <a
            className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)]"
            href="/api/auth/neodb/login"
          >
            {t("timeline.login")}
          </a>
        }
        description={t("timeline.guestDescription")}
        icon={<PersonTimelineIcon />}
        title={t("timeline.guestTitle")}
      />
    );
  }

  if (state === "error") {
    return (
      <TimelineEmptyState
        description={t("timeline.publicErrorDescription")}
        icon={<CloudOffIcon />}
        title={t("timeline.publicErrorTitle")}
      />
    );
  }

  if (statuses.length === 0) {
    return (
      <TimelineEmptyState
        description={t("timeline.publicEmptyDescription")}
        icon={<PlazaIcon />}
        title={t("timeline.publicEmptyTitle")}
      />
    );
  }

  return (
    <div>
      <ActivityCardList onDelete={onDelete} onNavigate={handleTimelineItemNavigate} statuses={statuses} updateStatus={updateStatus} />
      <TimelineEndOfList />
    </div>
  );
}

function FollowingTimeline({
  hasMore,
  isLoadingMore,
  loadMore,
  onDelete,
  state,
  statuses,
  updateStatus,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  onDelete: (postId: string) => void;
  state: TimelineLoadState;
  statuses: TimelineStatus[];
  updateStatus: (
    postId: string,
    update: (status: TimelineStatus) => TimelineStatus,
  ) => void;
}) {
  const t = useT();

  if (state === "idle" || state === "loading") return <TimelineListSkeleton />;

  if (state === "guest") {
    return (
      <TimelineEmptyState
        action={
          <a
            className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)]"
            href="/api/auth/neodb/login"
          >
            {t("timeline.login")}
          </a>
        }
        description={t("timeline.guestDescription")}
        icon={<PersonTimelineIcon />}
        title={t("timeline.guestTitle")}
      />
    );
  }

  if (state === "error") {
    return (
      <TimelineEmptyState
        description={t("timeline.followingErrorDescription")}
        icon={<CloudOffIcon />}
        title={t("timeline.followingErrorTitle")}
      />
    );
  }

  if (statuses.length === 0) {
    return (
      <TimelineEmptyState
        description={t("timeline.followingEmptyDescription")}
        icon={<FriendsIcon />}
        title={t("timeline.followingEmptyTitle")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ActivityCardList onDelete={onDelete} onNavigate={handleTimelineItemNavigate} statuses={statuses} updateStatus={updateStatus} />
      {hasMore ? (
        <div className="flex justify-center">
          <button
            className="h-10 rounded-full border border-white/70 bg-white/60 px-5 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/80 active:scale-95 disabled:cursor-wait disabled:text-[#a4a6ad]"
            disabled={isLoadingMore}
            onClick={loadMore}
            type="button"
          >
            {isLoadingMore ? t("timeline.loadingMore") : t("timeline.loadMore")}
          </button>
        </div>
      ) : (
        <TimelineEndOfList />
      )}
    </div>
  );
}

function MineTimeline({
  hasMore,
  isLoadingMore,
  loadMore,
  onDelete,
  state,
  statuses,
  updateStatus,
}: {
  hasMore: boolean;
  isLoadingMore: boolean;
  loadMore: () => void;
  onDelete: (postId: string) => void;
  state: "loading" | "ready" | "guest" | "error";
  statuses: TimelineStatus[];
  updateStatus: (
    postId: string,
    update: (status: TimelineStatus) => TimelineStatus,
  ) => void;
}) {
  const t = useT();

  if (state === "loading") return <TimelineListSkeleton />;

  if (state === "guest") {
    return (
      <TimelineEmptyState
        action={
          <a
            className="mt-5 inline-flex h-11 items-center rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)]"
            href="/api/auth/neodb/login"
          >
            {t("timeline.login")}
          </a>
        }
        description={t("timeline.guestDescription")}
        icon={<PersonTimelineIcon />}
        title={t("timeline.guestTitle")}
      />
    );
  }

  if (state === "error") {
    return (
      <TimelineEmptyState
        description={t("timeline.errorDescription")}
        icon={<CloudOffIcon />}
        title={t("timeline.errorTitle")}
      />
    );
  }

  if (statuses.length === 0) {
    return (
      <TimelineEmptyState
        description={t("timeline.mineEmptyDescription")}
        icon={<TimelineEmptyIcon />}
        title={t("timeline.mineEmptyTitle")}
      />
    );
  }

  return (
    <div className="space-y-5">
      <ActivityCardList onDelete={onDelete} onNavigate={handleTimelineItemNavigate} statuses={statuses} updateStatus={updateStatus} />
      {hasMore ? (
        <div className="flex justify-center">
          <button
            className="h-10 rounded-full border border-white/70 bg-white/60 px-5 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/80 active:scale-95 disabled:cursor-wait disabled:text-[#a4a6ad]"
            disabled={isLoadingMore}
            onClick={loadMore}
            type="button"
          >
            {isLoadingMore ? t("timeline.loadingMore") : t("timeline.loadMore")}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function handleTimelineItemNavigate() {
  window.sessionStorage.setItem(TIMELINE_SCROLL_KEY, String(window.scrollY));
  window.sessionStorage.setItem(TIMELINE_RESTORE_KEY, "1");
}

function TimelineEndOfList() {
  const t = useT();

  return (
    <div className="mt-6 text-center text-xs font-semibold text-[#75777d]">
      {t("home.endOfList")}
    </div>
  );
}

function TimelineEmptyState({
  action,
  description,
  icon,
  title,
}: {
  action?: React.ReactNode;
  description: string;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div className="flex min-h-[50dvh] flex-col items-center justify-center px-6 text-center">
      <div className="grid size-16 place-items-center rounded-full border border-white/70 bg-white/60 text-[#75777d] shadow-lg shadow-slate-900/5 backdrop-blur-2xl">
        {icon}
      </div>
      <h1 className="mt-5 text-lg font-bold text-[var(--foreground)]">{title}</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#75777d]">{description}</p>
      {action}
    </div>
  );
}

function mergeStatuses(current: TimelineStatus[], incoming: TimelineStatus[]) {
  const ids = new Set(current.map((status) => status.id));
  return [...current, ...incoming.filter((status) => !ids.has(status.id))];
}

function normalizeTimelineView(value: string | null): TimelineView {
  return value === "following" || value === "mine" ? value : "public";
}

function updateTimelineViewUrl(view: TimelineView) {
  window.history.replaceState(null, "", getTimelineViewHref(view));
}

function getTimelineViewHref(view: TimelineView) {
  return view === "public" ? "/timeline" : `/timeline?view=${view}`;
}

function getTimelineSwipeClass(transition: SwipeTransition | null) {
  if (!transition) return "";

  if (transition.phase === "exit") {
    return transition.direction === "left"
      ? "home-swipe-exit-left"
      : "home-swipe-exit-right";
  }

  return transition.direction === "left"
    ? "home-swipe-enter-right"
    : "home-swipe-enter-left";
}

function applyTimelinePayload(
  payload: TimelineResponse,
  setters: {
    setHasMore: (value: boolean) => void;
    setNextMaxId: (value: string | null) => void;
    setStatuses: (value: TimelineStatus[]) => void;
  },
) {
  setters.setStatuses(payload.statuses);
  setters.setNextMaxId(payload.nextMaxId);
  setters.setHasMore(payload.hasMore);
}

function RefreshIcon({
  className = "",
  rotation = 0,
}: {
  className?: string;
  rotation?: number;
}) {
  return (
    <svg
      aria-hidden="true"
      className={`size-[1.125rem] ${className}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      style={className ? undefined : { transform: `rotate(${rotation}deg)` }}
      viewBox="0 0 24 24"
    >
      <path d="M20 11a8 8 0 1 0-2.3 5.7" />
      <path d="M20 4v7h-7" />
    </svg>
  );
}
function PlazaIcon() {
  return <svg aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.6 3.6 5.6 3.6 9S14.4 18.4 12 21c-2.4-2.6-3.6-5.6-3.6-9S9.6 5.6 12 3Z" /></svg>;
}
function FriendsIcon() {
  return <svg aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3" /><path d="M3 20a6 6 0 0 1 12 0M16 5a3 3 0 0 1 0 6M17 14a5 5 0 0 1 4 5" /></svg>;
}
function PersonTimelineIcon() {
  return <svg aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeWidth="1.7" viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></svg>;
}
function CloudOffIcon() {
  return <svg aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24"><path d="m3 3 18 18M7.7 7.7A6 6 0 0 1 18 12.2a4 4 0 0 1 .5 7.8H7a5 5 0 0 1-3.5-8.6" /></svg>;
}
function TimelineEmptyIcon() {
  return <svg aria-hidden="true" className="size-7" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="1.7" viewBox="0 0 24 24"><path d="M7 7.5h10M7 12h7" /><path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" /></svg>;
}
function BellIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.9" viewBox="0 0 24 24"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>;
}
