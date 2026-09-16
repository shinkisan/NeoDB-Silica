"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import { beginPress, isPrimaryPress } from "@/components/press-surface";
import { useTopBarContextVisibility } from "@/components/use-top-bar-context-visibility";
import styles from "@/components/floating-top-bar.module.css";

export function FloatingTopBar({
  children,
  className = "fixed inset-x-0 top-0 z-[60]",
  rowClassName = "max-w-2xl",
}: {
  children: ReactNode;
  className?: string;
  rowClassName?: string;
}) {
  return (
    <header className={`${styles.bar} ${className} px-4 sm:px-5`}>
      <div aria-hidden="true" className={styles.backdrop} />
      <div
        className={`relative z-10 mx-auto flex h-16 items-center gap-3 ${rowClassName}`}
      >
        {children}
      </div>
    </header>
  );
}

/** Title that fades in once the page's own heading has scrolled past the bar,
 * centered unless it overflows and has to marquee. */
export function TopBarTitle({
  className = "min-w-0 flex-1",
  contextKey,
  contextSelector,
  title,
}: {
  className?: string;
  contextKey?: string;
  contextSelector?: string;
  title: string;
}) {
  const isVisible = useTopBarContextVisibility({
    contextKey: contextKey || title,
    selector: contextSelector,
  });
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    function measureTitle() {
      const frame = frameRef.current;
      const titleNode = titleRef.current;

      if (frame && titleNode) {
        setIsOverflowing(titleNode.scrollWidth > frame.clientWidth);
      }
    }

    measureTitle();

    const observer = new ResizeObserver(measureTitle);

    if (frameRef.current) {
      observer.observe(frameRef.current);
    }

    return () => observer.disconnect();
  }, [title]);

  return (
    <div
      aria-hidden={!isVisible}
      className={`relative overflow-hidden whitespace-nowrap text-base font-bold text-[var(--foreground)] transition-[opacity,transform] duration-200 ease-out ${className} ${
        isOverflowing ? "text-left" : "text-center"
      } ${
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

export function TopBarIsland({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`${styles.glassIsland} liquid-glass relative shrink-0 rounded-full border border-white/50 ${className}`}
      data-lg-cab="2"
      data-lg-depth="4"
      data-lg-strength="34"
      // The island is the glass the press is felt on: the control inside is
      // transparent, so scaling that would only nudge its icon a few pixels.
      onPointerDown={(event) => {
        const target = event.target;
        const isInteractiveTarget =
          target instanceof Element &&
          target.closest("button, a, [role='button']") !== null;

        if (isInteractiveTarget && isPrimaryPress(event)) {
          beginPress(event.currentTarget);
        }
      }}
      ref={registerLiquidGlass}
    >
      {children}
    </div>
  );
}
