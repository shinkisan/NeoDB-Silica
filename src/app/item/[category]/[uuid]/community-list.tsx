"use client";

import Link from "next/link";
import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { showToast } from "@/components/app-toast";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { RatingBadge, StatusBadge } from "@/components/mark-badges";
import { ReviewReaderTrigger } from "@/components/review-reader-trigger";
import { SpoilerText } from "@/components/spoiler-text";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { BoostButton } from "@/components/boost-button";
import { CommentFavouriteButton } from "./comment-favourite-button";
import {
  CommentTranslationButton,
  useCommentTranslation,
} from "./comment-translation";
import { CommentReplies } from "./comment-replies";
import { CommunityTime } from "./community-time";
import type {
  CommunityCommentProps,
  CommunityOwnEntries,
  CommunityPage,
} from "@/lib/community";
import {
  dispatchReviewStateChange,
  readReviewStateSnapshot,
} from "@/lib/review-state";
import { invalidateTimelineCache } from "@/lib/timeline-cache";
import { renderTextWithEmoji } from "@/lib/mastodon-emoji";
import { formatAccountHandle } from "@/lib/account-handle";
import {
  DETAIL_COMMENT_LOCAL_EVENT,
  DETAIL_COMMENTS_CACHE_PREFIX,
  DETAIL_COMMENTS_REFRESH_EVENT,
  DETAIL_COMMENTS_REUSE_PREFIX,
  DETAIL_COMMUNITY_TAB_PREFIX,
  DETAIL_OPEN_SHORT_REVIEW_EVENT,
  DETAIL_RESTORE_PREFIX,
  DETAIL_REVIEW_LOCAL_PREFIX,
  DETAIL_SCROLL_PREFIX,
  type DetailCommentLocalEvent,
  type DetailReviewLocalSnapshot,
} from "./detail-state";

type CurrentUserProfile = {
  avatar?: string;
  display_name?: string;
  external_acct?: string | null;
  external_accounts?: Array<{ acct?: string; handle?: string }>;
  id?: string;
  username?: string;
};

type CommunityTab = "comments" | "reviews";
type CommunityTabDirection = "left" | "right";

type TabState = {
  count: number;
  hasMore: boolean;
  isLoadingMore: boolean;
  items: CommunityCommentProps[];
  page: number;
};

const EMPTY_TAB_STATE: TabState = {
  count: -1,
  hasMore: false,
  isLoadingMore: false,
  items: [],
  page: 0,
};

type CachedCommunityState = {
  commentsState: TabState;
  ownEntries: CommunityOwnEntries;
  reviewsState: TabState;
};

function pageToTabState(page: CommunityPage): TabState {
  return {
    count: page.count,
    hasMore: page.hasMore,
    isLoadingMore: false,
    items: page.items,
    page: page.page,
  };
}

async function fetchTabPage(
  category: string,
  itemUuid: string,
  type: "comment" | "review",
  page: number,
): Promise<CommunityPage> {
  const params = new URLSearchParams({
    category,
    itemUuid,
    page: String(page),
    type,
  });
  const response = await fetch(`/api/neodb/item-posts?${params.toString()}`);

  if (!response.ok) {
    throw new Error("fetch_failed");
  }

  return (await response.json()) as CommunityPage;
}

export function CommunityList({
  category,
  initialCommentsPage,
  initialOwnEntries,
  initialReviewsPage,
  itemUuid,
  neodbInstance = "",
  reviewActions,
}: {
  category: string;
  initialCommentsPage?: CommunityPage;
  initialOwnEntries?: CommunityOwnEntries;
  initialReviewsPage?: CommunityPage;
  itemUuid: string;
  neodbInstance: string;
  reviewActions?: ReactNode;
}) {
  const t = useT();
  const [initialState] = useState(() => {
    const shouldReuseCachedState = consumeCommentsReuseRequest(itemUuid);
    const cachedState = shouldReuseCachedState ? readCachedState(itemUuid) : null;

    return {
      cachedState,
      shouldReuseCachedState,
    };
  });
  const shouldReuseCachedStateRef = useRef(initialState.shouldReuseCachedState);
  const [commentsState, setCommentsState] = useState<TabState>(
    () =>
      initialState.cachedState?.commentsState ||
      (initialCommentsPage ? pageToTabState(initialCommentsPage) : EMPTY_TAB_STATE),
  );
  const [reviewsState, setReviewsState] = useState<TabState>(
    () =>
      initialState.cachedState?.reviewsState ||
      (initialReviewsPage ? pageToTabState(initialReviewsPage) : EMPTY_TAB_STATE),
  );
  const [ownEntries, setOwnEntries] = useState<CommunityOwnEntries>(
    () =>
      initialState.cachedState?.ownEntries ||
      initialOwnEntries || { comment: null, review: null },
  );
  const [activeTab, setActiveTab] = useState<CommunityTab>("comments");
  const [isLoading, setIsLoading] = useState(
    () => !initialState.cachedState && !initialCommentsPage,
  );
  const [currentUser, setCurrentUser] = useState<CurrentUserProfile | null>(null);
  const [tabAnimationDirection, setTabAnimationDirection] =
    useState<CommunityTabDirection | null>(null);
  const communityRootRef = useRef<HTMLDivElement>(null);
  const currentUserRef = useRef<CurrentUserProfile | null>(null);
  const tabGestureStartRef = useRef<{
    id: number;
    x: number;
    y: number;
  } | null>(null);
  const suppressGestureClickRef = useRef(false);
  const pendingLocalCommentRef = useRef<DetailCommentLocalEvent | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);
  const requestIdRef = useRef(0);
  const reviewsFetchStartedRef = useRef(false);

  const activeTabState = activeTab === "comments" ? commentsState : reviewsState;

  useEffect(() => {
    currentUserRef.current = currentUser;
  }, [currentUser]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled && consumeStoredCommunityTab(itemUuid) === "reviews") {
        setActiveTab("reviews");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [itemUuid]);

  useEffect(() => {
    writeCachedState(itemUuid, { commentsState, ownEntries, reviewsState });
  }, [commentsState, itemUuid, ownEntries, reviewsState]);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/neodb/me")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as CurrentUserProfile;
      })
      .then((profile) => {
        if (!cancelled && profile) {
          setCurrentUser(profile);
          const ownAccounts = getProfileAccounts(profile);

          setCommentsState((current) => ({
            ...current,
            items: current.items.map((item) => ({
              ...item,
              isOwn: isCommentByAccount(item, ownAccounts),
            })),
          }));
          setReviewsState((current) => ({
            ...current,
            items: current.items.map((item) => ({
              ...item,
              isOwn: isCommentByAccount(item, ownAccounts),
            })),
          }));
        }
      })
      .catch(() => {
        // Keep fallback identity for local-only updates.
      });

    return () => {
      cancelled = true;
    };
  }, [itemUuid]);

  useEffect(() => {
    let cancelled = false;

    function mergePendingLocalComment(own: CommunityOwnEntries): CommunityOwnEntries {
      const pending = pendingLocalCommentRef.current;

      if (!pending || pending.itemUuid !== itemUuid) {
        return own;
      }

      const pendingComment = pending.commentText.trim();

      if (!pendingComment) {
        pendingLocalCommentRef.current = null;
        return own;
      }

      if (own.comment?.comment.trim() === pendingComment) {
        pendingLocalCommentRef.current = null;
        return own;
      }

      return {
        ...own,
        comment: buildLocalCommentEntry(
          own.comment,
          pending,
          currentUserRef.current,
          category,
          itemUuid,
          t,
        ),
      };
    }

    async function refreshOwn() {
      try {
        const params = new URLSearchParams({ category, itemUuid, type: "own" });
        const response = await fetch(`/api/neodb/item-posts?${params.toString()}`);

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as CommunityOwnEntries;

        if (!cancelled) {
          setOwnEntries(
            mergePendingLocalComment(applyKnownReviewState(itemUuid, payload)),
          );
        }
      } catch {
        // Keep the current own entries if a background refresh fails.
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    function applyLocalComment(event: Event) {
      const detail = (event as CustomEvent<DetailCommentLocalEvent>).detail;

      if (detail.itemUuid !== itemUuid) {
        return;
      }

      pendingLocalCommentRef.current = detail;
      setOwnEntries((prev) => ({
        ...prev,
        comment: buildLocalCommentEntry(
          prev.comment,
          detail,
          currentUserRef.current,
          category,
          itemUuid,
          t,
        ),
      }));
    }

    function applyLocalReview(snapshot: DetailReviewLocalSnapshot) {
      if (snapshot.itemUuid !== itemUuid) {
        return;
      }

      setOwnEntries((prev) => ({
        ...prev,
        review: buildLocalReviewEntry(
          prev.review,
          snapshot,
          currentUserRef.current,
          category,
          itemUuid,
          t,
        ),
      }));
    }

    const pendingReview = readLocalReviewSnapshot(itemUuid);

    if (pendingReview) {
      applyLocalReview(pendingReview);
      void refreshOwn();
    } else if (shouldReuseCachedStateRef.current) {
      const cached = readCachedState(itemUuid);

      if (cached) {
        const nextOwn = applyKnownReviewState(itemUuid, cached.ownEntries);

        window.queueMicrotask(() => {
          if (!cancelled) {
            setCommentsState(cached.commentsState);
            setReviewsState(cached.reviewsState);
            setOwnEntries(nextOwn);
            setIsLoading(false);
          }
        });
      } else {
        void refreshOwn();
      }
    } else if (initialOwnEntries) {
      const nextOwn = applyKnownReviewState(itemUuid, initialOwnEntries);

      window.queueMicrotask(() => {
        if (!cancelled) {
          setOwnEntries(nextOwn);
          setIsLoading(false);
        }
      });
    } else {
      void refreshOwn();
    }

    if (!commentsState.page) {
      void fetchTabPage(category, itemUuid, "comment", 1)
        .then((data) => {
          if (!cancelled) {
            setCommentsState(pageToTabState(data));
          }
        })
        .catch(() => {
          // Keep the empty state if the fallback fetch fails.
        });
    }

    window.addEventListener(DETAIL_COMMENTS_REFRESH_EVENT, refreshOwn);
    window.addEventListener(DETAIL_COMMENT_LOCAL_EVENT, applyLocalComment);

    return () => {
      cancelled = true;
      window.removeEventListener(DETAIL_COMMENTS_REFRESH_EVENT, refreshOwn);
      window.removeEventListener(DETAIL_COMMENT_LOCAL_EVENT, applyLocalComment);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, initialOwnEntries, itemUuid, t]);

  useEffect(() => {
    if (
      activeTab !== "reviews" ||
      reviewsState.page !== 0 ||
      reviewsFetchStartedRef.current
    ) {
      return;
    }

    reviewsFetchStartedRef.current = true;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    queueMicrotask(() => {
      if (requestIdRef.current === requestId) {
        setReviewsState((current) => ({ ...current, isLoadingMore: true }));
      }
    });

    fetchTabPage(category, itemUuid, "review", 1)
      .then((data) => {
        if (requestIdRef.current === requestId) {
          setReviewsState(pageToTabState(data));
        }
      })
      .catch(() => {
        if (requestIdRef.current === requestId) {
          reviewsFetchStartedRef.current = false;
          setReviewsState((current) => ({ ...current, isLoadingMore: false }));
        }
      });
  }, [activeTab, category, itemUuid, reviewsState.page]);

  useEffect(() => {
    if (
      activeTabState.page === 0 ||
      !activeTabState.hasMore ||
      activeTabState.isLoadingMore
    ) {
      return;
    }

    const target = loadMoreRef.current;

    if (!target) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    const nextPage = activeTabState.page + 1;
    const type = activeTab === "comments" ? "comment" : "review";
    const setTabState = activeTab === "comments" ? setCommentsState : setReviewsState;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) {
          return;
        }

        setTabState((current) => ({ ...current, isLoadingMore: true }));

        fetchTabPage(category, itemUuid, type, nextPage)
          .then((data) => {
            if (requestIdRef.current !== requestId) {
              return;
            }

            setTabState((current) => ({
              count: data.count,
              hasMore: data.hasMore,
              isLoadingMore: false,
              items: [...current.items, ...data.items],
              page: nextPage,
            }));
          })
          .catch(() => {
            if (requestIdRef.current === requestId) {
              setTabState((current) => ({ ...current, isLoadingMore: false }));
            }
          });
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(target);

    return () => observer.disconnect();
  }, [
    activeTab,
    activeTabState.hasMore,
    activeTabState.isLoadingMore,
    activeTabState.page,
    category,
    itemUuid,
  ]);

  const handleDeleteComment = useCallback(
    async (postId: string) => {
      setOwnEntries((prev) =>
        prev.comment?.postId === postId ? { ...prev, comment: null } : prev,
      );
      setCommentsState((prev) => ({
        ...prev,
        items: prev.items.filter((c) => c.postId !== postId),
      }));

      try {
        const response = await fetch(
          `/api/neodb/comment?itemUuid=${encodeURIComponent(itemUuid)}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
        } else {
          invalidateTimelineCache();
          showToast(t("community.deletedComment"));
        }
      } catch {
        window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
      }
    },
    [itemUuid, t],
  );

  const handleDeleteReview = useCallback(
    async (postId: string) => {
      setOwnEntries((prev) =>
        prev.review?.postId === postId ? { ...prev, review: null } : prev,
      );
      setReviewsState((prev) => ({
        ...prev,
        items: prev.items.filter((c) => c.postId !== postId),
      }));

      try {
        const response = await fetch(
          `/api/neodb/review?itemUuid=${encodeURIComponent(itemUuid)}`,
          { method: "DELETE" },
        );

        if (!response.ok) {
          window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
        } else {
          invalidateTimelineCache();
          dispatchReviewStateChange(itemUuid, false);
          showToast(t("community.deletedReview"));
        }
      } catch {
        window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
      }
    },
    [itemUuid, t],
  );

  if (isLoading) {
    return <CommunityLoadingSkeleton />;
  }

  const ownPinned = activeTab === "comments" ? ownEntries.comment : ownEntries.review;
  const dedupedItems = activeTabState.items.filter((item) =>
    ownPinned ? item.postId !== ownPinned.postId && !item.isOwn : true,
  );
  const visibleItems = ownPinned ? [ownPinned, ...dedupedItems] : dedupedItems;
  const isInitialTabLoading =
    activeTabState.page === 0 && activeTabState.isLoadingMore;
  const communityCountText = t("community.totalCount")
    .replace("{shortCount}", commentsState.count >= 0 ? String(commentsState.count) : "–")
    .replace("{longCount}", reviewsState.count >= 0 ? String(reviewsState.count) : "–");
  const tabAnimationClass =
    tabAnimationDirection === "left"
      ? "home-swipe-enter-right"
      : tabAnimationDirection === "right"
        ? "home-swipe-enter-left"
        : "";

  function changeActiveTab(nextTab: CommunityTab) {
    if (nextTab === activeTab) {
      return;
    }

    setTabAnimationDirection(nextTab === "reviews" ? "left" : "right");
    setActiveTab(nextTab);
    scrollCommunityToTop(communityRootRef.current);
  }

  function handleTabContentPointerDown(
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (
      !event.isPrimary ||
      event.pointerType === "mouse" ||
      isInteractiveGestureTarget(event.target)
    ) {
      return;
    }

    tabGestureStartRef.current = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
  }

  function handleTabContentPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const start = tabGestureStartRef.current;

    if (!start || start.id !== event.pointerId) {
      return;
    }

    tabGestureStartRef.current = null;

    const deltaX = event.clientX - start.x;
    const deltaY = event.clientY - start.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (absX < 64 || absX < absY * 1.35) {
      return;
    }

    const nextTab =
      deltaX < 0 && activeTab === "comments"
        ? "reviews"
        : deltaX > 0 && activeTab === "reviews"
          ? "comments"
          : null;

    if (!nextTab) {
      return;
    }

    suppressGestureClickRef.current = true;
    changeActiveTab(nextTab);
    window.setTimeout(() => {
      suppressGestureClickRef.current = false;
    }, 0);
  }

  return (
    <div className="space-y-6" ref={communityRootRef}>
      <CommunityTabs
        activeTab={activeTab}
        countText={communityCountText}
        onChange={changeActiveTab}
        reviewActions={reviewActions}
      />
      <div
        className={`min-h-24 touch-pan-y motion-safe:will-change-transform ${tabAnimationClass}`}
        onAnimationEnd={(event) => {
          if (event.currentTarget === event.target) {
            setTabAnimationDirection(null);
          }
        }}
        onClickCapture={(event) => {
          if (!suppressGestureClickRef.current) {
            return;
          }

          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerCancel={() => {
          tabGestureStartRef.current = null;
        }}
        onPointerDown={handleTabContentPointerDown}
        onPointerUp={handleTabContentPointerUp}
      >
        {isInitialTabLoading ? (
          <div className="flex justify-center py-6">
            <CommunityLoopSpinner />
          </div>
        ) : visibleItems.length ? (
          <div className="space-y-6">
            {visibleItems.map((comment) =>
              activeTab === "reviews" ? (
                <CommunityReview
                  {...comment}
                  key={`review-${comment.postId}`}
                  neodbInstance={neodbInstance}
                  onDeleteReview={handleDeleteReview}
                />
              ) : (
                <CommunityComment
                  {...comment}
                  key={`comment-${comment.postId}`}
                  neodbInstance={neodbInstance}
                  onDeleteComment={handleDeleteComment}
                  onDeleteReview={handleDeleteReview}
                />
              ),
            )}
            {activeTabState.hasMore ? (
              <div aria-hidden="true" className="h-px" ref={loadMoreRef} />
            ) : null}
            {activeTabState.isLoadingMore ? (
              <div className="flex justify-center pt-2">
                <CommunityLoopSpinner />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-4 text-sm text-[#44474c]">
            {activeTab === "reviews"
              ? t("community.noReviews")
              : t("detail.noComments")}
          </p>
        )}
      </div>
    </div>
  );
}

function CommunityTabs({
  activeTab,
  countText,
  onChange,
  reviewActions,
}: {
  activeTab: CommunityTab;
  countText: string;
  onChange: (tab: CommunityTab) => void;
  reviewActions?: ReactNode;
}) {
  const t = useT();

  return (
    <div className="space-y-3">
      <div className="flex min-h-10 items-center justify-between gap-3">
        <div className="flex h-10 items-center gap-6">
          <CommunityTabButton
            isActive={activeTab === "comments"}
            label={t("community.shortComments")}
            onClick={() => onChange("comments")}
          />
          <CommunityTabButton
            isActive={activeTab === "reviews"}
            label={t("community.longReviews")}
            onClick={() => onChange("reviews")}
          />
        </div>
        {activeTab === "reviews" && reviewActions ? (
          <div className="shrink-0">{reviewActions}</div>
        ) : null}
      </div>
      <div className="flex min-h-5 items-center">
        <p className="text-sm font-semibold text-[#9a9ca3]">{countText}</p>
      </div>
    </div>
  );
}

function CommunityTabButton({
  isActive,
  label,
  onClick,
}: {
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`relative inline-flex h-10 cursor-pointer items-center text-xl font-semibold transition ${
        isActive ? "text-[var(--foreground)]" : "text-[#9a9ca3]"
      }`}
      onClick={onClick}
      type="button"
    >
      <span>{label}</span>
      {isActive ? (
        <span
          aria-hidden="true"
          className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-current"
        />
      ) : null}
    </button>
  );
}

export function CommunityLoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex min-h-10 items-center justify-between gap-3">
          <div className="flex h-10 items-center gap-6">
            <div className="relative inline-flex h-10 items-center">
              <div className="h-8 w-12 rounded-full bg-[#dde3eb]" />
              <span
                aria-hidden="true"
                className="absolute -bottom-1 left-1/2 size-1.5 -translate-x-1/2 rounded-full bg-[#dde3eb]"
              />
            </div>
            <div className="h-8 w-12 rounded-full bg-[#dde3eb]" />
          </div>
        </div>
        <div className="flex min-h-5 items-center">
          <div className="h-4 w-24 rounded-full bg-[#dde3eb]" />
        </div>
      </div>
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex animate-pulse gap-4" key={index}>
          <div className="size-10 shrink-0 rounded-full bg-[#dde3eb]" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-3 w-28 rounded-full bg-[#dde3eb]" />
            <div className="flex gap-2">
              <div className="h-6 w-16 rounded-full bg-[#dde3eb]" />
              <div className="h-6 w-20 rounded-full bg-[#dde3eb]" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-full rounded-full bg-[#dde3eb]" />
              <div className="h-3 w-2/3 rounded-full bg-[#dde3eb]" />
              {index === 0 ? (
                <div className="h-3 w-5/6 rounded-full bg-[#dde3eb]" />
              ) : null}
            </div>
            <div className="flex gap-4">
              <div className="h-4 w-12 rounded-full bg-[#dde3eb]" />
              <div className="h-4 w-16 rounded-full bg-[#dde3eb]" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CommunityLoopSpinner() {
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

const CommunityComment = memo(function CommunityComment({
  authorAcct,
  authorId,
  authorUsername,
  avatar,
  category,
  comment,
  contentEmojis,
  contentMentions,
  createdAt,
  disabled,
  favourited,
  favouritesCount,
  isOwn,
  itemUuid,
  name,
  nameEmojis,
  neodbInstance,
  onDeleteComment,
  onDeleteReview,
  postId,
  rating,
  reblogged,
  reblogsCount,
  repliesCount,
  review,
  status,
  time,
  visibility,
}: CommunityCommentProps & {
  neodbInstance: string;
  onDeleteComment: (postId: string) => void;
  onDeleteReview: (postId: string) => void;
}) {
  const [didAvatarFail, setDidAvatarFail] = useState(false);
  const t = useT();
  const [deleteTarget, setDeleteTarget] = useState<"comment" | "review" | null>(
    null,
  );
  const [markVisibility, setMarkVisibility] = useState(
    typeof visibility === "number" ? visibility : 0,
  );
  const translation = useCommentTranslation(comment || "");
  const [currentReblogged, setCurrentReblogged] = useState(reblogged);
  const [currentReblogsCount, setCurrentReblogsCount] = useState(reblogsCount);
  const authorHandle = formatAccountHandle(authorAcct || authorUsername);

  useEffect(() => {
    window.queueMicrotask(() => setDidAvatarFail(false));
  }, [avatar]);

  useEffect(() => {
    window.queueMicrotask(() => {
      setCurrentReblogged(reblogged);
      setCurrentReblogsCount(reblogsCount);
    });
  }, [reblogged, reblogsCount]);

  useEffect(() => {
    if (typeof visibility === "number") {
      window.queueMicrotask(() => {
        setMarkVisibility(Math.min(2, Math.max(0, visibility)));
      });
    }
  }, [visibility]);

  useEffect(() => {
    if (!isOwn) {
      return;
    }

    fetch(`/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as { visibility?: number } | null;
      })
      .then((data) => {
        if (typeof data?.visibility === "number") {
          setMarkVisibility(Math.min(2, Math.max(0, data.visibility)));
        }
      })
      .catch(() => {
        // Keep default visibility
      });
  }, [isOwn, itemUuid]);

  function handleDeleteConfirm() {
    if (deleteTarget === "comment") {
      onDeleteComment(postId);
    } else if (deleteTarget === "review") {
      onDeleteReview(postId);
    }

    setDeleteTarget(null);
  }

  return (
    <article className="flex min-w-0 gap-4">
      <CommunityAccountLink
        authorId={authorId}
        className="shrink-0"
        communityTab="comments"
        itemUuid={itemUuid}
      >
        {avatar && !didAvatarFail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-10 shrink-0 rounded-full border-2 border-white bg-[#dde3eb] object-cover"
            loading="lazy"
            onError={() => setDidAvatarFail(true)}
            src={avatar}
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-white bg-[#dde3eb] text-sm font-bold text-[#333e50]">
            {name.slice(0, 1)}
          </div>
        )}
      </CommunityAccountLink>
      <div className="min-w-0 flex-1">
        <CommunityAccountLink
          authorId={authorId}
          className="text-sm font-bold text-[var(--foreground)] hover:underline"
          communityTab="comments"
          itemUuid={itemUuid}
        >
          {renderTextWithEmoji(name, nameEmojis)}
        </CommunityAccountLink>
        {authorHandle ? (
          <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-[#75777d]">
            {authorHandle}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {status ? <StatusBadge category={category} status={status} /> : null}
          {typeof rating === "number" ? (
            isOwn ? (
              <button onClick={() => dispatchOpenShortReview(itemUuid)} type="button">
                <RatingBadge value={rating} />
              </button>
            ) : (
              <RatingBadge value={rating} />
            )
          ) : null}
          {isOwn ? (
            <button onClick={() => dispatchOpenShortReview(itemUuid, true)} type="button">
              <VisibilityBadge value={markVisibility} />
            </button>
          ) : null}
        </div>
        {comment ? (
          <p
            className={`mt-3 min-w-0 max-w-full whitespace-pre-line break-words text-base leading-relaxed text-[#44474c] [overflow-wrap:anywhere]${isOwn ? " cursor-pointer" : ""}`}
            onClick={isOwn ? () => dispatchOpenShortReview(itemUuid) : undefined}
          >
            <SpoilerText
              emojis={contentEmojis}
              mentions={contentMentions}
              onNavigate={() => recordDetailNavigation(itemUuid, "comments")}
              text={comment}
            />
          </p>
        ) : null}
        {comment && translation.isExpanded && translation.translatedText ? (
          <p className="mt-2 min-w-0 max-w-full whitespace-pre-line break-words border-l-2 border-[#c5c6cd]/60 pl-3 text-base leading-relaxed text-[#5f6268] [overflow-wrap:anywhere]">
            <SpoilerText
              emojis={contentEmojis}
              mentions={contentMentions}
              onNavigate={() => recordDetailNavigation(itemUuid, "comments")}
              text={translation.translatedText}
            />
          </p>
        ) : null}
        {review ? (
          <div className="mt-3">
            <ReviewReaderTrigger
              apiUrl={review.apiUrl}
              body={review.body}
              className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-white/65 px-3 py-1.5 text-xs font-bold text-[#333e50] shadow-sm transition hover:bg-white/90"
              externalUrl={review.url}
              reviewUuid={review.uuid}
              shareUrl={review.url}
              title={review.title}
            >
              <span className="truncate">{t("detail.reviewLink").replace("{title}", review.title)}</span>
              <LinkIcon />
            </ReviewReaderTrigger>
          </div>
        ) : null}
        <CommunityTime className="mt-2 text-xs font-semibold text-[#75777d]" createdAt={createdAt} fallback={time} />
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-2 text-[#75777d]">
          <CommentFavouriteButton
            count={favouritesCount}
            disabled={disabled}
            favourited={favourited}
            postId={postId}
          />
          {comment ? (
            <CommentReplies
              disabled={disabled}
              isOwnThread={isOwn}
              onNavigate={() => recordDetailNavigation(itemUuid, "comments")}
              postId={postId}
              repliesCount={repliesCount}
            />
          ) : null}
          {comment ? (
            <span className="-ml-1.5">
              <BoostButton
                count={currentReblogsCount}
                disabled={disabled}
                onChange={(next) => {
                  setCurrentReblogged(next.reblogged);
                  setCurrentReblogsCount(next.count);
                }}
                postId={postId}
                reblogged={currentReblogged}
                variant="icon"
              />
            </span>
          ) : null}
          {comment ? (
            <span className="-ml-1.5">
              <CommentTranslationButton
                isExpanded={translation.isExpanded}
                isLoading={translation.isLoading}
                onClick={translation.toggleTranslation}
              />
            </span>
          ) : null}
          {isOwn && comment ? (
            <button
              aria-label={t("community.deleteComment")}
              className="-ml-1.5 grid size-8 cursor-pointer place-items-center rounded-full text-[#75777d] transition hover:bg-white/70 hover:text-red-600 active:scale-95"
              onClick={() => setDeleteTarget("comment")}
              type="button"
            >
              <TrashIcon />
            </button>
          ) : null}
          {isOwn && review ? (
            <button
              aria-label={t("community.deleteReview")}
              className="grid size-8 cursor-pointer place-items-center rounded-full text-[#75777d] transition hover:bg-white/70 hover:text-red-600 active:scale-95"
              onClick={() => setDeleteTarget("review")}
              type="button"
            >
              <TrashIcon />
            </button>
          ) : null}
        </div>
      </div>

      {deleteTarget ? (
        <ConfirmDialog
          confirmLabel={t("community.delete")}
          description={
            deleteTarget === "comment"
              ? t("community.deleteCommentDesc")
              : t("community.deleteReviewDesc")
          }
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDeleteConfirm}
          title={
            deleteTarget === "comment"
              ? t("community.deleteCommentTitle")
              : t("community.deleteReviewTitle")
          }
        />
      ) : null}
    </article>
  );
});

function LinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2a5 5 0 0 0 7.1 7.1l1.1-1.1" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}

const CommunityReview = memo(function CommunityReview({
  authorAcct,
  authorId,
  authorUsername,
  avatar,
  category,
  createdAt,
  disabled,
  favourited,
  favouritesCount,
  isOwn,
  itemUuid,
  name,
  nameEmojis,
  neodbInstance = "",
  onDeleteReview,
  postId,
  rating,
  reblogged,
  reblogsCount,
  repliesCount,
  review,
  status,
  time,
  visibility,
}: CommunityCommentProps & {
  neodbInstance?: string;
  onDeleteReview: (postId: string) => void;
}) {
  const [didAvatarFail, setDidAvatarFail] = useState(false);
  const t = useT();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [markVisibility, setMarkVisibility] = useState(
    typeof visibility === "number" ? visibility : 0,
  );
  const authorHandle = formatAccountHandle(authorAcct || authorUsername);

  useEffect(() => {
    window.queueMicrotask(() => setDidAvatarFail(false));
  }, [avatar]);

  useEffect(() => {
    if (typeof visibility === "number") {
      window.queueMicrotask(() => {
        setMarkVisibility(Math.min(2, Math.max(0, visibility)));
      });
    }
  }, [visibility]);

  useEffect(() => {
    if (!isOwn) {
      return;
    }

    fetch(`/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as { visibility?: number } | null;
      })
      .then((data) => {
        if (typeof data?.visibility === "number") {
          setMarkVisibility(Math.min(2, Math.max(0, data.visibility)));
        }
      })
      .catch(() => {
        // Keep default visibility
      });
  }, [isOwn, itemUuid]);

  if (!review) {
    return null;
  }

  const excerpt = getReviewExcerpt(review.body || "");

  return (
    <article className="flex min-w-0 gap-4">
      <CommunityAccountLink
        authorId={authorId}
        className="shrink-0"
        communityTab="reviews"
        itemUuid={itemUuid}
      >
        {avatar && !didAvatarFail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-10 shrink-0 rounded-full border-2 border-white bg-[#dde3eb] object-cover"
            loading="lazy"
            onError={() => setDidAvatarFail(true)}
            src={avatar}
          />
        ) : (
          <div className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-white bg-[#dde3eb] text-sm font-bold text-[#333e50]">
            {name.slice(0, 1)}
          </div>
        )}
      </CommunityAccountLink>
      <div className="min-w-0 flex-1">
        <CommunityAccountLink
          authorId={authorId}
          className="text-sm font-bold text-[var(--foreground)] hover:underline"
          communityTab="reviews"
          itemUuid={itemUuid}
        >
          {renderTextWithEmoji(name, nameEmojis)}
        </CommunityAccountLink>
        {authorHandle ? (
          <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-[#75777d]">
            {authorHandle}
          </div>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {status ? <StatusBadge category={category} status={status} /> : null}
          {typeof rating === "number" ? (
            isOwn ? (
              <button onClick={() => dispatchOpenShortReview(itemUuid)} type="button">
                <RatingBadge value={rating} />
              </button>
            ) : (
              <RatingBadge value={rating} />
            )
          ) : null}
          {isOwn ? (
            <button onClick={() => dispatchOpenShortReview(itemUuid, true)} type="button">
              <VisibilityBadge value={markVisibility} />
            </button>
          ) : null}
        </div>
        <ReviewReaderTrigger
          apiUrl={review.apiUrl}
          body={review.body}
          className="mt-3 block w-full cursor-pointer text-left"
          disabled={disabled}
          externalUrl={review.url}
          favourited={favourited}
          favouritesCount={favouritesCount}
          isOwn={isOwn}
          neodbInstance={neodbInstance}
          postId={postId}
          reblogged={reblogged}
          reblogsCount={reblogsCount}
          repliesCount={repliesCount}
          reviewUuid={review.uuid}
          shareUrl={review.url}
          title={review.title}
        >
          <h3 className="line-clamp-2 break-words text-lg font-bold leading-snug text-[#333e50] transition hover:text-[var(--theme-primary)] [overflow-wrap:anywhere]">
            {review.title}
          </h3>
          {excerpt ? (
            <p className="mt-2 line-clamp-3 whitespace-pre-line break-words text-base leading-relaxed text-[#44474c] [overflow-wrap:anywhere]">
              {excerpt}
            </p>
          ) : null}
        </ReviewReaderTrigger>
        <CommunityTime className="mt-2 text-xs font-semibold text-[#75777d]" createdAt={createdAt} fallback={time} />
        {isOwn ? (
          <div className="mt-2">
            <button
              aria-label={t("community.deleteReview")}
              className="grid size-8 cursor-pointer place-items-center rounded-full text-[#75777d] transition hover:bg-white/70 hover:text-red-600 active:scale-95"
              onClick={() => setIsDeleteOpen(true)}
              type="button"
            >
              <TrashIcon />
            </button>
          </div>
        ) : null}
      </div>

      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={t("community.delete")}
          description={t("community.deleteReviewDesc")}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={() => {
            onDeleteReview(postId);
            setIsDeleteOpen(false);
          }}
          title={t("community.deleteReviewTitle")}
        />
      ) : null}
    </article>
  );
});

function recordDetailNavigation(itemUuid: string, communityTab: CommunityTab) {
  window.sessionStorage.setItem(
    `${DETAIL_SCROLL_PREFIX}${itemUuid}`,
    String(window.scrollY),
  );
  window.sessionStorage.setItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`, "1");
  window.sessionStorage.setItem(`${DETAIL_COMMENTS_REUSE_PREFIX}${itemUuid}`, "1");
  window.sessionStorage.setItem(
    `${DETAIL_COMMUNITY_TAB_PREFIX}${itemUuid}`,
    communityTab,
  );
}

function CommunityAccountLink({
  authorId,
  children,
  className = "",
  communityTab,
  itemUuid,
}: {
  authorId?: string;
  children: ReactNode;
  className?: string;
  communityTab: CommunityTab;
  itemUuid: string;
}) {
  if (!authorId) {
    return <div className={className}>{children}</div>;
  }

  const href = `/user/${encodeURIComponent(authorId)}`;

  return (
    <Link
      className={`inline-block ${className}`.trim()}
      href={href}
      onClick={() => {
        recordDetailNavigation(itemUuid, communityTab);
        pushNavigationFrame("detail", href);
      }}
    >
      {children}
    </Link>
  );
}

function VisibilityBadge({ value }: { value: number }) {
  const t = useT();

  return (
    <span className="visibility-badge inline-flex items-center rounded-full border border-[#d9d9de]/80 bg-[#ececef]/75 px-2.5 py-1 text-xs font-bold text-[#75777d] dark:border-[#52525b]/60 dark:bg-[#3f3f46]/80 dark:text-white">
      {value === 0
        ? t("shortReview.visibility.publicFull")
        : value === 1
          ? t("shortReview.visibility.followersFull")
          : t("shortReview.visibility.privateFull")}
    </span>
  );
}

function getReviewExcerpt(body: string) {
  return body
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/[*_~`>#-]/g, "")
    .replace(/\|/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function readLocalReviewSnapshot(itemUuid: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${DETAIL_REVIEW_LOCAL_PREFIX}${itemUuid}`;
  const rawSnapshot = window.sessionStorage.getItem(key);

  if (!rawSnapshot) {
    return null;
  }

  window.sessionStorage.removeItem(key);

  try {
    const snapshot = JSON.parse(rawSnapshot) as DetailReviewLocalSnapshot;
    return snapshot.itemUuid === itemUuid ? snapshot : null;
  } catch {
    return null;
  }
}

function getProfileAccounts(profile: CurrentUserProfile) {
  return new Set(
    [
      profile.username,
      profile.external_acct,
      ...(profile.external_accounts || []).flatMap((account) => [
        account.acct,
        account.handle,
      ]),
    ]
      .map(normalizeAccount)
      .filter(Boolean),
  );
}

function isInteractiveGestureTarget(target: EventTarget | null) {
  return (
    target instanceof Element &&
    Boolean(target.closest("input, select, textarea, [contenteditable='true']"))
  );
}

function scrollCommunityToTop(root: HTMLElement | null) {
  if (!root) {
    return;
  }

  const topBarOffset = 80;
  const rootTop = root.getBoundingClientRect().top;

  if (rootTop >= topBarOffset) {
    return;
  }

  window.scrollTo({
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
    top: window.scrollY + rootTop - topBarOffset,
  });
}

function isCommentByAccount(
  comment: CommunityCommentProps,
  ownAccounts: Set<string>,
) {
  const authorAccounts = [comment.authorUsername, comment.authorAcct]
    .map(normalizeAccount)
    .filter(Boolean);

  return authorAccounts.length === 0
    ? comment.isOwn
    : authorAccounts.some((account) => ownAccounts.has(account));
}

function normalizeAccount(account?: string | null) {
  return account?.trim().replace(/^@/, "").toLocaleLowerCase() || "";
}

function readCachedState(itemUuid: string): CachedCommunityState | null {
  if (typeof window === "undefined") {
    return null;
  }

  const key = `${DETAIL_COMMENTS_CACHE_PREFIX}${itemUuid}`;
  const rawCache = window.sessionStorage.getItem(key);

  if (!rawCache) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCache) as Partial<CachedCommunityState>;

    if (!parsed.commentsState || !parsed.reviewsState || !parsed.ownEntries) {
      return null;
    }

    return parsed as CachedCommunityState;
  } catch {
    window.sessionStorage.removeItem(key);

    return null;
  }
}

function applyKnownReviewState(
  itemUuid: string,
  own: CommunityOwnEntries,
): CommunityOwnEntries {
  const reviewState = readReviewStateSnapshot(itemUuid);
  return reviewState?.hasReview === false ? { ...own, review: null } : own;
}

function buildLocalCommentEntry(
  existing: CommunityCommentProps | null,
  detail: DetailCommentLocalEvent,
  user: CurrentUserProfile | null,
  category: string,
  itemUuid: string,
  t: (key: string) => string,
): CommunityCommentProps | null {
  const nextComment = detail.commentText.trim();

  if (!nextComment) {
    return null;
  }

  const nextRating = detail.ratingGrade > 0 ? detail.ratingGrade : null;
  const fallbackName = user?.display_name || user?.username || t("community.me");

  return {
    avatar: existing?.avatar || user?.avatar || "",
    authorId: existing?.authorId || user?.id,
    authorUsername: existing?.authorUsername || user?.username,
    category,
    comment: nextComment,
    createdAt: existing?.createdAt || new Date().toISOString(),
    disabled: false,
    favourited: existing?.favourited || false,
    favouritesCount: existing?.favouritesCount || 0,
    isOwn: true,
    itemUuid,
    name: existing?.name || fallbackName,
    postId: existing?.postId || `local-${itemUuid}`,
    rating: nextRating,
    reblogged: existing?.reblogged ?? false,
    reblogsCount: existing?.reblogsCount ?? 0,
    repliesCount: existing?.repliesCount ?? 0,
    review: existing?.review || null,
    status: detail.shelfType,
    time: existing?.time || t("community.justNow"),
    visibility: detail.visibility,
  };
}

function buildLocalReviewEntry(
  existing: CommunityCommentProps | null,
  snapshot: DetailReviewLocalSnapshot,
  user: CurrentUserProfile | null,
  category: string,
  itemUuid: string,
  t: (key: string) => string,
): CommunityCommentProps {
  const fallbackName = user?.display_name || user?.username || t("community.me");

  return {
    avatar: existing?.avatar || user?.avatar || "",
    authorId: existing?.authorId || user?.id,
    authorUsername: existing?.authorUsername || user?.username,
    category,
    comment: existing?.comment || "",
    createdAt: existing?.createdAt || new Date().toISOString(),
    disabled: false,
    favourited: existing?.favourited || false,
    favouritesCount: existing?.favouritesCount || 0,
    isOwn: true,
    itemUuid,
    name: existing?.name || fallbackName,
    postId: existing?.postId || `local-review-${itemUuid}`,
    rating: existing?.rating ?? null,
    reblogged: existing?.reblogged ?? false,
    reblogsCount: existing?.reblogsCount ?? 0,
    repliesCount: existing?.repliesCount ?? 0,
    review: {
      apiUrl: null,
      body: snapshot.body,
      title: snapshot.title,
      url: null,
      uuid: null,
    },
    status: existing?.status || "complete",
    time: existing?.time || t("community.justNow"),
    visibility: snapshot.visibility,
  };
}

function consumeCommentsReuseRequest(itemUuid: string) {
  if (typeof window === "undefined") {
    return false;
  }

  const key = `${DETAIL_COMMENTS_REUSE_PREFIX}${itemUuid}`;
  const shouldReuse = window.sessionStorage.getItem(key) === "1";
  window.sessionStorage.removeItem(key);

  return shouldReuse;
}

function consumeStoredCommunityTab(itemUuid: string): CommunityTab {
  if (typeof window === "undefined") {
    return "comments";
  }

  const key = `${DETAIL_COMMUNITY_TAB_PREFIX}${itemUuid}`;
  const value = window.sessionStorage.getItem(key);
  window.sessionStorage.removeItem(key);

  return value === "reviews" ? "reviews" : "comments";
}

function dispatchOpenShortReview(itemUuid: string, openMore = false) {
  window.dispatchEvent(
    new CustomEvent(DETAIL_OPEN_SHORT_REVIEW_EVENT, {
      detail: { itemUuid, openMore },
    }),
  );
}

function writeCachedState(itemUuid: string, state: CachedCommunityState) {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.setItem(
    `${DETAIL_COMMENTS_CACHE_PREFIX}${itemUuid}`,
    JSON.stringify(state),
  );
}
