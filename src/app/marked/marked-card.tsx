"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/use-t";
import {
  RatingBadge,
  StatusBadge,
  type ShelfType,
} from "@/components/mark-badges";
import type { HomeItem } from "@/lib/neodb";
import { MarkedCardBody } from "./marked-card-body";
import {
  MARKED_REFRESH_ITEM_EVENT,
  readMarkedItemSnapshot,
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
  shelf_type: ShelfType;
};

type MarkSnapshot = {
  commentText?: string;
  createdTime?: string;
  itemUuid: string;
  ratingGrade?: number;
  shelfType: ShelfType | null;
};

export function MarkedCard({
  item,
  mark,
  shelf,
}: {
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
  const [shelfType, setShelfType] = useState<ShelfType>(mark.shelf_type);
  const markedDate = formatMarkedDate(createdTime);

  useEffect(() => {
    let cancelled = false;

    function applySnapshot(snapshot: MarkSnapshot) { 

      if (!snapshot.shelfType || snapshot.shelfType !== shelf) {
        setIsVisible(false);
        return;
      }

      setCommentText(snapshot.commentText || "");
      if (snapshot.createdTime !== undefined) {
        setCreatedTime(snapshot.createdTime);
      }
      setIsVisible(true);
      setRatingGrade(snapshot.ratingGrade ?? null);
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

  return (
    <article className="surface-glow rounded-xl border border-white/70 bg-white/55 p-3 shadow-lg shadow-slate-900/5">
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
        <div className="flex h-[8.666rem] min-w-0 flex-col overflow-hidden py-0.5 sm:h-40">
          <h3 className="truncate text-base font-bold leading-6 text-[var(--foreground)]">
            {item.title}
          </h3>

          {markedDate ? (
            <div className="mt-1 truncate text-xs font-semibold leading-4 text-[#75777d]">
              {markedDate}
            </div>
          ) : null}

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
            <RatingBadge value={ratingGrade} />
            <StatusBadge category={mark.item.category} status={shelfType} />
          </div>

          <p className="mt-2 line-clamp-3 min-h-[3.75rem] shrink-0 break-words text-sm leading-5 text-[#44474c] max-sm:line-clamp-2 max-sm:min-h-10">
            {commentText ? revealSpoilers(commentText) : t("marked.noComment")}
          </p>
        </div>
      </MarkedCardBody>
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
