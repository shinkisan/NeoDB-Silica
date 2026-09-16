"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { DETAIL_SCROLL_TOP_PREFIX } from "@/lib/detail-scroll";
import { DETAIL_RESTORE_PREFIX } from "./detail-state";
import topBarStyles from "@/components/floating-top-bar.module.css";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import { beginPress, isPrimaryPress } from "@/components/press-surface";

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
      className={`${topBarStyles.bar} px-4 sm:px-5`}
      style={{
        left: 0,
        position: "fixed",
        right: 0,
        top: 0,
        zIndex: 60,
      }}
    >
      <div aria-hidden="true" className={topBarStyles.backdrop} />
      <div className="relative z-10 mx-auto flex h-16 max-w-4xl items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <button
            aria-label="关闭详情页"
            className={`${topBarStyles.glassIsland} liquid-glass relative grid size-10 shrink-0 place-items-center rounded-full border border-white/50 text-[#44474c] shadow-sm shadow-slate-900/5 transition hover:bg-white/80 disabled:cursor-default`}
            data-lg-depth="4"
            ref={registerLiquidGlass}
            data-lg-strength="34"
            data-lg-cab="2"
            onClick={(event) => {
              event.currentTarget.disabled = true;
              performNavigationClose(resolveDetailCloseAction(), router);
            }}
            onPointerDown={(event) => {
              if (isPrimaryPress(event)) {
                beginPress(event.currentTarget);
              }
            }}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <div
          className={`${topBarStyles.glassIsland} liquid-glass relative flex h-10 shrink-0 items-center rounded-full border border-white/50 shadow-sm shadow-slate-900/5`}
          data-lg-depth="4"
          ref={registerLiquidGlass}
          data-lg-strength="34"
          data-lg-cab="2"
        >
          <div className="mx-3 h-4 w-14 animate-pulse rounded-full bg-[#d9dde5]" />
          <span aria-hidden="true" className="h-4 w-px bg-[var(--foreground)] opacity-20" />
          <div className="grid size-10 shrink-0 place-items-center text-[#a4a6ad]">
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
