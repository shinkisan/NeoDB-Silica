"use client";

import { Suspense, useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { LazyReadingProgressDialog } from "@/components/lazy-reading-progress-dialog";
import { useT } from "@/components/use-t";
import { fetchBookPageCount } from "@/lib/google-books-client";
import {
  RatingBadge,
  StatusBadge,
  type ShelfType,
} from "@/components/mark-badges";
import type { HomeItem } from "@/lib/neodb";
import {
  formatReadingProgressShort,
  type ReadingProgress,
} from "@/lib/reading-progress";
import { submitReadingProgress } from "@/lib/reading-progress-client";
import {
  getReadingProgressRatio,
  readReadingProgressTotals,
  READING_PROGRESS_TOTAL_UPDATED_EVENT,
  writeReadingProgressTotal,
  type ReadingProgressTotalUpdatedEvent,
} from "@/lib/reading-progress-total";
import { MarkedCardBody } from "./marked-card-body";
import {
  MARKED_REFRESH_ITEM_EVENT,
  readMarkedItemSnapshot,
  syncMarkedReadingProgress,
  type MarkedRefreshItemEvent,
} from "./marked-refresh";

type MarkedCardMark = {
  comment_text?: string | null;
  created_time?: string | null;
  item: {
    category: string;
    uuid: string;
  };
  rating_grade?: number | null;
  reading_progress?: ReadingProgress | null;
  shelf_type: ShelfType;
};

type MarkSnapshot = {
  commentText?: string;
  createdTime?: string;
  itemUuid: string;
  ratingGrade?: number;
  readingProgress?: ReadingProgress | null;
  shelfType: ShelfType | null;
};

export function MarkedCard({
  cacheScope,
  item,
  mark,
  shelf,
}: {
  cacheScope: string;
  item: HomeItem;
  mark: MarkedCardMark;
  shelf: ShelfType;
}) {
  const t = useT();
  const itemUuid = mark.item.uuid;
  const [commentText, setCommentText] = useState(mark.comment_text || "");
  const [createdTime, setCreatedTime] = useState(mark.created_time || "");
  const [isVisible, setIsVisible] = useState(true);
  const [ratingGrade, setRatingGrade] = useState(
    mark.rating_grade ?? null,
  );
  const [readingProgress, setReadingProgress] = useState<ReadingProgress | null>(
    mark.reading_progress ?? null,
  );
  const [isProgressOpen, setIsProgressOpen] = useState(false);
  const [readingProgressTotals, setReadingProgressTotals] = useState(
    {} as ReturnType<typeof readReadingProgressTotals>,
  );
  const [shelfType, setShelfType] = useState<ShelfType>(mark.shelf_type);
  const markedDate = formatMarkedDate(createdTime);
  const readingProgressLabel =
    formatReadingProgressShort(readingProgress, t) ||
    t("mark.readingProgress.emptyBadge");
  const readingProgressRatio = getReadingProgressRatio(
    readingProgress,
    readingProgressTotals,
  );

  useEffect(() => {
    function syncTotals(event: Event) {
      const detail = (event as ReadingProgressTotalUpdatedEvent).detail;

      if (detail.scope === cacheScope && detail.itemUuid === itemUuid) {
        setReadingProgressTotals(detail.totals);
      }
    }

    queueMicrotask(() =>
      setReadingProgressTotals(
        readReadingProgressTotals(cacheScope, itemUuid),
      ),
    );
    window.addEventListener(READING_PROGRESS_TOTAL_UPDATED_EVENT, syncTotals);

    return () =>
      window.removeEventListener(
        READING_PROGRESS_TOTAL_UPDATED_EVENT,
        syncTotals,
      );
  }, [cacheScope, itemUuid]);

  useEffect(() => {
    if (readingProgress?.type !== "page") {
      return;
    }

    const totals = readReadingProgressTotals(cacheScope, itemUuid);

    if (totals.page) {
      queueMicrotask(() => setReadingProgressTotals(totals));
      return;
    }

    const itemPageCount = Number(item.pages);

    if (Number.isFinite(itemPageCount) && itemPageCount > 0) {
      queueMicrotask(() =>
        setReadingProgressTotals(
          writeReadingProgressTotal(
            cacheScope,
            itemUuid,
            "page",
            itemPageCount,
            "item",
          ),
        ),
      );
      return;
    }

    let cancelled = false;

    fetchBookPageCount({ isbn: item.isbn, itemUuid }).then((result) => {
      if (cancelled || !result) {
        return;
      }

      setReadingProgressTotals(
        writeReadingProgressTotal(
          cacheScope,
          itemUuid,
          "page",
          result.pageCount,
          result.source,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [cacheScope, item.isbn, item.pages, itemUuid, readingProgress?.type]);

  useEffect(() => {
    if (mark.reading_progress === undefined) {
      return;
    }

    const nextProgress = mark.reading_progress;
    queueMicrotask(() => setReadingProgress(nextProgress));
  }, [mark.reading_progress]);

  useEffect(() => {
    let cancelled = false;

    function applySnapshot(snapshot: MarkSnapshot) { 

      if (!snapshot.shelfType || snapshot.shelfType !== shelf) {
        setIsVisible(false);
        return;
      }

      if (snapshot.commentText !== undefined) {
        setCommentText(snapshot.commentText || "");
      }
      if (snapshot.createdTime !== undefined) {
        setCreatedTime(snapshot.createdTime);
      }
      setIsVisible(true);
      if (snapshot.ratingGrade !== undefined) {
        setRatingGrade(snapshot.ratingGrade ?? null);
      }
      if (snapshot.readingProgress !== undefined) {
        setReadingProgress(snapshot.readingProgress);
      }
      setShelfType(snapshot.shelfType);
    }

    const pendingSnapshot = readMarkedItemSnapshot(itemUuid) as MarkSnapshot | null;

    if (pendingSnapshot) {
      applySnapshot(pendingSnapshot);
    }

    async function refreshItem(nextItemUuid: string) { 

      if (nextItemUuid !== itemUuid) {
        return;
      }

      const pendingSnapshot = readMarkedItemSnapshot(itemUuid) as MarkSnapshot | null; 

      if (pendingSnapshot) {
        applySnapshot(pendingSnapshot);
        return;
      }

      try {
        const response = await fetch(
          `/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`,
        );

        if (!response.ok) { 
          return;
        }

        const snapshot = (await response.json()) as MarkSnapshot;

        if (cancelled) {
          return;
        }

        applySnapshot(snapshot);
      } catch {
        // Keep the existing card state if the focused refresh fails.
      }
    }

    function handleRefresh(event: Event) {
      refreshItem((event as MarkedRefreshItemEvent).detail?.itemUuid || "");
    }

    window.addEventListener(MARKED_REFRESH_ITEM_EVENT, handleRefresh);

    return () => {
      cancelled = true;
      window.removeEventListener(MARKED_REFRESH_ITEM_EVENT, handleRefresh);
    };
  }, [itemUuid, shelf]);

  if (!isVisible) {
    return null;
  }

  async function saveReadingProgress(progress: ReadingProgress | null) {
    try {
      const nextProgress = await submitReadingProgress(itemUuid, progress);

      setReadingProgress(nextProgress);
      syncMarkedReadingProgress(itemUuid, nextProgress, shelfType);
      showToast(t("mark.readingProgress.saved"));
      return true;
    } catch (error) {
      console.error("[mark] reading progress save failed", error);
      showToast(t("mark.readingProgress.saveError"), "error");
      return false;
    }
  }

  return (
    <article className="surface-glow relative rounded-xl border border-white/70 bg-white/55 p-3 shadow-lg shadow-slate-900/5">
      <MarkedCardBody
        className="grid w-full cursor-pointer grid-cols-[6.5rem_minmax(0,1fr)] items-start gap-4 rounded-xl text-left transition active:scale-[0.99] sm:grid-cols-[7.5rem_minmax(0,1fr)]"
        href={item.detailPath}
        itemUuid={itemUuid}
      >
        <div className="aspect-[3/4] overflow-hidden rounded-xl bg-[#e2e2e5]">
          {item.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={item.title}
              className="h-full w-full object-cover transition duration-500 hover:scale-105"
              decoding="async"
              loading="lazy"
              src={item.coverUrl}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-[#75777d]">
              {item.title}
            </div>
          )}
        </div>
        <div className="flex min-h-[8.666rem] min-w-0 flex-col py-0.5 sm:min-h-40">
          <h3 className="truncate text-base font-bold leading-6 text-[var(--foreground)]">
            {item.title}
          </h3>

          {markedDate ||
          (mark.item.category === "book" && shelfType === "progress") ? (
            <div className="mt-1 flex min-w-0 items-center gap-2">
              {markedDate ? (
                <span className="shrink-0 text-xs font-semibold leading-4 text-[#75777d]">
                  {markedDate}
                </span>
              ) : null}
              {mark.item.category === "book" && shelfType === "progress" ? (
                <button
                  aria-label={t("mark.readingProgress.set")}
                  className="inline-flex h-7 min-w-0 max-w-36 items-center rounded-full border border-white/70 bg-white/50 px-2.5 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95"
                  data-card-nav-ignore
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsProgressOpen(true);
                  }}
                  title={t("mark.readingProgress.set")}
                  type="button"
                >
                  <span className="truncate">{readingProgressLabel}</span>
                </button>
              ) : null}
            </div>
          ) : null}

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            <RatingBadge value={ratingGrade} />
            <StatusBadge
              category={mark.item.category}
              progressRatio={
                mark.item.category === "book" && shelfType === "progress"
                  ? readingProgressRatio
                  : null
              }
              status={shelfType}
            />
          </div>

          <p className="mt-2 line-clamp-3 break-words text-sm leading-5 text-[#44474c] max-sm:line-clamp-2">
            {commentText ? revealSpoilers(commentText) : t("marked.noComment")}
          </p>
        </div>
      </MarkedCardBody>
      {isProgressOpen ? (
        <Suspense fallback={null}>
          <LazyReadingProgressDialog
            isbn={item.isbn}
            itemPageCount={item.pages}
            itemUuid={itemUuid}
            initialProgress={readingProgress}
            onCancel={() => setIsProgressOpen(false)}
            onSave={saveReadingProgress}
            storageScope={cacheScope}
          />
        </Suspense>
      ) : null}
    </article>
  );
}

function revealSpoilers(value: string) {
  return value.replace(/>!([^!]+)!</g, "$1");
}

function formatMarkedDate(value?: string | null) {
  if (!value) {
    return "";
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);

  if (match) {
    return match[1];
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
