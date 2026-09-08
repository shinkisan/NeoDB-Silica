"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { useTopBarContextVisibility } from "@/components/use-top-bar-context-visibility";

export function CreditsTopBar({
  contextKey,
  contextSelector,
  title,
}: {
  contextKey?: string;
  contextSelector?: string;
  title: string;
}) {
  const router = useRouter();
  const isTitleVisible = useTopBarContextVisibility({
    contextKey: contextKey || title,
    selector: contextSelector,
  });

  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
        <button
          aria-label="关闭演职员页"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95 disabled:cursor-default"
          onClick={(event) => {
            event.currentTarget.disabled = true;
            performNavigationClose(resolveDetailCloseAction(), router);
          }}
          type="button"
        >
          <CloseIcon />
        </button>
        <CreditsTopBarTitle isVisible={isTitleVisible} title={title} />
        <div aria-hidden="true" className="size-10 shrink-0" />
      </div>
    </header>
  );
}

function CreditsTopBarTitle({
  isVisible,
  title,
}: {
  isVisible: boolean;
  title: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    function measureTitle() {
      const frame = frameRef.current;
      const titleNode = titleRef.current;

      if (!frame || !titleNode) {
        return;
      }

      setIsOverflowing(titleNode.scrollWidth > frame.clientWidth);
    }

    measureTitle();

    const observer = new ResizeObserver(measureTitle);

    if (frameRef.current) {
      observer.observe(frameRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [title]);

  return (
    <div
      aria-hidden={!isVisible}
      className={`relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-base font-bold text-[var(--foreground)] transition-[opacity,transform] duration-200 ease-out ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      ref={frameRef}
    >
      {isOverflowing ? (
        <span className="detail-title-marquee inline-flex">
          <span className="pr-6">{title}</span>
          <span aria-hidden="true" className="pr-6">
            {title}
          </span>
        </span>
      ) : (
        <span>{title}</span>
      )}
      <span
        aria-hidden="true"
        className="pointer-events-none invisible absolute whitespace-nowrap"
        ref={titleRef}
      >
        {title}
      </span>
    </div>
  );
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
