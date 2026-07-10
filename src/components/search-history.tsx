"use client";

import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const SEARCH_HISTORY_KEY = `${STORAGE_PREFIX}v1:search-history`;
const SEARCH_HISTORY_LIMIT = 5;

export function readSearchHistory() {
  try {
    const raw = window.localStorage.getItem(SEARCH_HISTORY_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, SEARCH_HISTORY_LIMIT);
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string) {
  const trimmedQuery = query.trim();

  if (!trimmedQuery) {
    return [];
  }

  const nextHistory = [
    trimmedQuery,
    ...readSearchHistory().filter((item) => item !== trimmedQuery),
  ].slice(0, SEARCH_HISTORY_LIMIT);

  try {
    window.localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(nextHistory));
  } catch {
    // The search history is only a local convenience.
  }

  return nextHistory;
}

export function clearSearchHistory() {
  try {
    window.localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function SearchHistoryPopover({
  clearLabel,
  ignoreRef,
  items,
  onClear,
  onClose,
  onSelect,
  title,
}: {
  clearLabel: string;
  ignoreRef?: RefObject<HTMLElement | null>;
  items: string[];
  onClear: () => void;
  onClose: () => void;
  onSelect: (query: string) => void;
  title: string;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function closeOnOutsidePointer(event: PointerEvent) {
      const target = event.target as Node;

      if (
        popoverRef.current?.contains(target) ||
        ignoreRef?.current?.contains(target)
      ) {
        return;
      }

      onClose();
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsidePointer);
    };
  }, [ignoreRef, onClose]);

  if (!items.length) {
    return null;
  }

  return (
    <div
      className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-[85] overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-2 shadow-xl shadow-slate-900/10"
      ref={popoverRef}
    >
      <div className="mb-1 flex items-center justify-between gap-3 px-2">
        <span className="text-xs font-bold text-[#75777d]">{title}</span>
        <button
          className="rounded-full px-2 py-1 text-xs font-bold text-[#75777d] transition hover:bg-[#e2e2e5]/70 hover:text-[#44474c]"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onClear}
          type="button"
        >
          {clearLabel}
        </button>
      </div>
      <div className="space-y-1">
        {items.map((item) => (
          <button
            className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-semibold text-[#44474c] transition hover:bg-[#e2e2e5]/70"
            key={item}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(item)}
            type="button"
          >
            <HistoryIcon />
            <span className="min-w-0 truncate">{item}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function HistoryIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0 text-[#8a8d94]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 4v5h5" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
