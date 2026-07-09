"use client";

import { useEffect, useRef, useState } from "react";
import type { HomeItem } from "@/lib/neodb";
import { useT } from "@/components/use-t";

type SearchSuggestion = {
  category: string;
  categoryLabel: string;
  detailPath: string;
  id: string;
  title: string;
};

type SearchSuggestionsPopoverProps = {
  category: string;
  onClose: () => void;
  onSelect: (item: SearchSuggestion) => void;
  query: string;
  visible: boolean;
};

const MIN_QUERY_LENGTH = 2;
const SUGGESTION_LIMIT = 5;
const SUGGESTION_DELAY_MS = 500;

export function SearchSuggestionsPopover({
  category,
  onClose,
  onSelect,
  query,
  visible,
}: SearchSuggestionsPopoverProps) {
  const t = useT();
  const [items, setItems] = useState<SearchSuggestion[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const popoverRef = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();

  useEffect(() => {
    if (!visible || trimmedQuery.length < MIN_QUERY_LENGTH) {
      setItems([]);
      setStatus("idle");
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({
        pageSize: String(SUGGESTION_LIMIT),
        query: trimmedQuery,
      });

      if (category && category !== "all") {
        params.set("category", category);
      }

      setStatus("loading");

      fetch(`/api/neodb/search?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      })
        .then(async (response) => {
          if (!response.ok) {
            throw new Error("suggestion failed");
          }

          return (await response.json()) as { items?: HomeItem[] };
        })
        .then((payload) => {
          setItems(
            (Array.isArray(payload.items) ? payload.items : [])
              .slice(0, SUGGESTION_LIMIT)
              .map((item) => ({
                category: item.category,
                categoryLabel: item.categoryLabel,
                detailPath:
                  item.detailPath ||
                  `/item/${item.category}/${encodeURIComponent(item.id)}`,
                id: item.id,
                title: item.title,
              })),
          );
          setStatus("ready");
        })
        .catch((error) => {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }

          setItems([]);
          setStatus("error");
        });
    }, SUGGESTION_DELAY_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [category, trimmedQuery, visible]);

  useEffect(() => {
    if (!visible) {
      return;
    }

    function closeOnOutsidePointer(event: PointerEvent) {
      if (popoverRef.current?.contains(event.target as Node)) {
        return;
      }

      onClose();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [onClose, visible]);

  if (!visible || trimmedQuery.length < MIN_QUERY_LENGTH) {
    return null;
  }

  if (status === "ready" && items.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[85] overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-2 shadow-xl shadow-slate-900/10"
      ref={popoverRef}
    >
      <div className="space-y-1">
        {status === "loading" ? (
          <SearchSuggestionSkeleton />
        ) : null}
        {status === "error" ? (
          <div className="px-3 py-2 text-sm font-semibold text-[#75777d]">
            {t("search.suggestionError")}
          </div>
        ) : null}
        {items.map((item) => (
          <button
            className="flex h-11 w-full min-w-0 items-center justify-between gap-3 rounded-xl px-3 text-left transition hover:bg-[#e2e2e5]/70"
            key={`${item.category}:${item.id}`}
            onClick={() => onSelect(item)}
            onMouseDown={(event) => event.preventDefault()}
            type="button"
          >
            <span className="min-w-0 truncate text-sm font-semibold text-[#44474c]">
              {item.title}
            </span>
            <span className="shrink-0 rounded-full border border-[#c5c6cd]/70 bg-white/70 px-2.5 py-1 text-xs font-bold text-[#44474c]">
              {item.categoryLabel}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function SearchSuggestionSkeleton() {
  return (
    <>
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex h-11 items-center justify-between gap-3 px-3" key={index}>
          <span className="h-4 w-36 animate-pulse rounded-full bg-[#e2e2e5]" />
          <span className="h-5 w-10 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      ))}
    </>
  );
}
