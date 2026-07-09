"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { DETAIL_SCROLL_TOP_PREFIX } from "@/lib/detail-scroll";
import { DETAIL_RESTORE_PREFIX } from "./detail-state";

export function LoadingTopBar() {
  const router = useRouter();

  useEffect(() => {
    const itemUuid = getCurrentItemUuid();
    const shouldRestore =
      new URLSearchParams(window.location.search).get("restoreScroll") === "1" ||
      Boolean(
        itemUuid &&
          window.sessionStorage.getItem(`${DETAIL_RESTORE_PREFIX}${itemUuid}`) ===
            "1",
      );
    const shouldScrollTop =
      Boolean(itemUuid) &&
      window.sessionStorage.getItem(`${DETAIL_SCROLL_TOP_PREFIX}${itemUuid}`) ===
        "1";

    if (shouldRestore || !shouldScrollTop) {
      return;
    }

    const frame = requestAnimationFrame(() => {
      window.scrollTo({ behavior: "instant", top: 0 });
      window.sessionStorage.removeItem(`${DETAIL_SCROLL_TOP_PREFIX}${itemUuid}`);
    });

    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <header
      className="border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl"
      style={{
        left: 0,
        position: "fixed",
        right: 0,
        top: 0,
        zIndex: 60,
      }}
    >
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-label="关闭详情页"
            className="grid size-10 shrink-0 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70"
            onClick={() =>
              performNavigationClose(resolveDetailCloseAction(), router)
            }
            type="button"
          >
            <CloseIcon />
          </button>
          <div className="size-10 shrink-0 animate-pulse rounded-full bg-[#d9dde5]" />
          <div className="h-5 w-32 min-w-0 animate-pulse rounded-full bg-[#d9dde5]" />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <div className="h-10 w-20 animate-pulse rounded-full bg-[#d9dde5]" />
          <div className="-mr-4 grid size-8 shrink-0 place-items-center text-[#a4a6ad]">
            <VerticalDotsIcon />
          </div>
        </div>
      </div>
    </header>
  );
}

function getCurrentItemUuid() {
  const [, appSegment, category, uuid] = window.location.pathname.split("/");

  if (appSegment !== "item" || !category || !uuid) {
    return "";
  }

  return decodeURIComponent(uuid);
}

function CloseIcon() {
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
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function VerticalDotsIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 animate-pulse"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}
