"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/use-t";
import { ReviewReaderTrigger } from "@/components/review-reader-trigger";
import {
  MARKED_REFRESH_ITEM_EVENT,
  type MarkedRefreshItemEvent,
} from "./marked-refresh";
import {
  readReviewStateSnapshot,
  REVIEW_STATE_EVENT,
  type ReviewStateEvent,
} from "@/lib/review-state";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

type ReviewSummary = {
  title?: string;
};

type ReviewSummaryState = {
  status: "ready" | "empty";
  title: string;
};

const REVIEW_SUMMARY_CACHE_PREFIX = `${STORAGE_PREFIX}v1:marked:review-summary:`;
const reviewSummaryCache = new Map<string, ReviewSummaryState>();

export function MarkedReviewLink({ itemUuid }: { itemUuid: string }) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "empty">("loading");

  useEffect(() => {
    let cancelled = false;

    function applySummary(summary: ReviewSummaryState) {
      setTitle(summary.title);
      setStatus(summary.status);
    }

    async function loadSummary({ force = false } = {}) {
      const reviewState = readReviewStateSnapshot(itemUuid);

      if (!force && reviewState?.hasReview === false) {
        const summary = { status: "empty" as const, title: "" };
        writeReviewSummaryCache(itemUuid, summary);
        applySummary(summary);
        return;
      }

      const cached = force ? null : readReviewSummaryCache(itemUuid);

      if (cached) {
        applySummary(cached);
        return;
      }

      setStatus("loading");

      try {
        const response = await fetch(
          `/api/neodb/review?itemUuid=${encodeURIComponent(itemUuid)}&summary=1`,
        );

        if (response.status === 404) {
          const summary = { status: "empty" as const, title: "" };
          writeReviewSummaryCache(itemUuid, summary);

          if (!cancelled) {
            applySummary(summary);
          }

          return;
        }

        if (!response.ok) {
          throw new Error("review summary failed");
        }

        const payload = (await response.json()) as ReviewSummary;
        const summary = payload?.title
          ? { status: "ready" as const, title: payload.title }
          : { status: "empty" as const, title: "" };

        writeReviewSummaryCache(itemUuid, summary);

        if (!cancelled) {
          applySummary(summary);
        }
      } catch {
        if (!cancelled) {
          applySummary({ status: "empty", title: "" });
        }
      }
    }

    function handleMarkedItemRefresh(event: Event) {
      const refreshedItemUuid =
        (event as MarkedRefreshItemEvent).detail?.itemUuid || "";

      if (refreshedItemUuid === itemUuid) {
        loadSummary({ force: true });
      }
    }

    function handleReviewState(event: Event) {
      const snapshot = (event as ReviewStateEvent).detail;

      if (snapshot?.itemUuid !== itemUuid) {
        return;
      }

      if (!snapshot.hasReview) {
        const summary = { status: "empty" as const, title: "" };
        writeReviewSummaryCache(itemUuid, summary);
        applySummary(summary);
        return;
      }

      loadSummary({ force: true });
    }

    loadSummary();
    window.addEventListener(MARKED_REFRESH_ITEM_EVENT, handleMarkedItemRefresh);
    window.addEventListener(REVIEW_STATE_EVENT, handleReviewState);

    return () => {
      cancelled = true;
      window.removeEventListener(
        MARKED_REFRESH_ITEM_EVENT,
        handleMarkedItemRefresh,
      );
      window.removeEventListener(REVIEW_STATE_EVENT, handleReviewState);
    };
  }, [itemUuid]);

  if (status === "loading") {
    return (
      <span className="inline-flex h-6 w-24 cursor-default animate-pulse rounded-full bg-[#e2e2e5]/80" />
    );
  }

  if (status === "empty" || !title) {
    return (
      <span className="inline-flex h-6 max-w-full cursor-default items-center gap-1.5 rounded-full bg-white/45 px-2.5 text-xs font-semibold text-[#75777d]">
         {t("marked.noReview")}
        <OpenIcon />
      </span>
    );
  }

  return (
    <ReviewReaderTrigger
      className="inline-flex h-6 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-white/65 px-2.5 text-xs font-bold text-[#333e50] shadow-sm transition hover:bg-white/90"
      itemUuid={itemUuid}
      title={title}
    >
      <span className="truncate">长评：{title}</span>
      <OpenIcon />
    </ReviewReaderTrigger>
  );
}

function readReviewSummaryCache(itemUuid: string) {
  const memoryCache = reviewSummaryCache.get(itemUuid);

  if (memoryCache) {
    return memoryCache;
  }

  try {
    const rawCache = window.sessionStorage.getItem(
      `${REVIEW_SUMMARY_CACHE_PREFIX}${itemUuid}`,
    );

    if (!rawCache) {
      return null;
    }

    const parsed = JSON.parse(rawCache) as ReviewSummaryState;

    if (parsed.status !== "ready" && parsed.status !== "empty") {
      return null;
    }

    reviewSummaryCache.set(itemUuid, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeReviewSummaryCache(itemUuid: string, summary: ReviewSummaryState) {
  reviewSummaryCache.set(itemUuid, summary);

  try {
    window.sessionStorage.setItem(
      `${REVIEW_SUMMARY_CACHE_PREFIX}${itemUuid}`,
      JSON.stringify(summary),
    );
  } catch {
    // The in-memory cache is enough for the current navigation session.
  }
}

function OpenIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}
