"use client";

import { useRef } from "react";
import { useT } from "@/components/use-t";

type HorizontalScrollControlsProps = {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  controlClassName?: string;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  viewportClassName?: string;
};

export function HorizontalScrollControls({
  children,
  className = "",
  contentClassName = "",
  controlClassName = "",
  viewportRef,
  viewportClassName = "",
}: HorizontalScrollControlsProps) {
  const t = useT();
  const scrollRef = useRef<HTMLDivElement>(null);

  function setScrollRef(element: HTMLDivElement | null) {
    scrollRef.current = element;

    if (viewportRef) {
      viewportRef.current = element;
    }
  }

  function scrollByDirection(direction: -1 | 1) {
    const viewport = scrollRef.current;

    if (!viewport) {
      return;
    }

    viewport.scrollBy({
      behavior: "smooth",
      left: direction * Math.max(180, viewport.clientWidth * 0.62),
    });
  }

  return (
    <div className={`relative ${className}`}>
      <span
        aria-hidden="true"
        className="horizontal-scroll-fade-left pointer-events-none absolute left-0 top-0 z-10 h-9 w-14"
      />
      <button
        aria-label={t("horizontalScroll.scrollLeft")}
        className={`absolute left-0 top-0 z-20 grid size-9 place-items-center rounded-full bg-transparent text-[#44474c] transition hover:bg-white/45 active:scale-95 ${controlClassName}`}
        onClick={() => scrollByDirection(-1)}
        type="button"
      >
        <ChevronIcon direction="left" />
      </button>
      <div
        className={`overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${viewportClassName}`}
        ref={setScrollRef}
      >
        <div className={contentClassName}>{children}</div>
      </div>
      <span
        aria-hidden="true"
        className="horizontal-scroll-fade-right pointer-events-none absolute right-0 top-0 z-10 h-9 w-14"
      />
      <button
        aria-label={t("horizontalScroll.scrollRight")}
        className={`absolute right-0 top-0 z-20 grid size-9 place-items-center rounded-full bg-transparent text-[#44474c] transition hover:bg-white/45 active:scale-95 ${controlClassName}`}
        onClick={() => scrollByDirection(1)}
        type="button"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.4"
      viewBox="0 0 24 24"
    >
      {direction === "left" ? (
        <path d="m15 18-6-6 6-6" />
      ) : (
        <path d="m9 18 6-6-6-6" />
      )}
    </svg>
  );
}
