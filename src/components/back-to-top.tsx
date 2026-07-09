"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";

// Deadzone (px) so tiny scroll jitter doesn't flip the inferred direction.
const SCROLL_DIRECTION_DEADZONE = 4;

/**
 * Floating "back to top" control for scrollable root and detail pages.
 *
 * On wide screens a larger rocket sits permanently beside the bottom-right of
 * the content area; `wideRight` is the CSS `right` offset (defaults to the
 * timeline's content geometry). When `includeCompact` is set, narrow screens
 * also get a compact rocket near the top (`compactTop` CSS offset, raised below
 * any fixed top bar) that appears while the user is scrolling back up, as long
 * as they're not already at the very top of the page.
 *
 * Rendered through a portal to `document.body` so it stays viewport-fixed even
 * when an ancestor establishes a containing block via `transform` (e.g. the
 * detail page enter animation) or clips overflow.
 *
 * Both rockets scroll to the page top by default; pass `onBackToTop` to scroll
 * somewhere else instead (e.g. a section within the page). `wideBottom` lets
 * the wide rocket stack above another fixed control instead of the default
 * bottom offset. The wide rocket is shown permanently by default; pass
 * `wideVisible` to gate it on caller-tracked state instead (e.g. only after
 * scrolling into a particular section). `compactVisible` (default `true`)
 * ANDs with the built-in scroll-direction logic, so a caller can force the
 * compact rocket to hide even while scrolling up (e.g. once the user has
 * scrolled back up to the top of the relevant section).
 */
export function BackToTopButton({
  compactTop = "2rem",
  compactVisible = true,
  includeCompact = true,
  onBackToTop,
  wideBottom = "2rem",
  wideRight = "max(1.25rem, calc(50vw - 30rem))",
  wideVisible = true,
}: {
  compactTop?: string;
  compactVisible?: boolean;
  includeCompact?: boolean;
  onBackToTop?: () => void;
  wideBottom?: string;
  wideRight?: string;
  wideVisible?: boolean;
}) {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [showCompact, setShowCompact] = useState(false);
  const lastScrollYRef = useRef(0);

  useEffect(() => {
    // Defer the portal until after hydration so server and first client render
    // both yield null, avoiding a hydration mismatch on the always-on button.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!includeCompact) return;

    lastScrollYRef.current = window.scrollY;
    let frame = 0;

    function evaluate() {
      frame = 0;
      const scrollY = window.scrollY;
      const delta = scrollY - lastScrollYRef.current;

      if (scrollY > 0 && delta < -SCROLL_DIRECTION_DEADZONE) {
        setShowCompact(true);
      } else if (delta > SCROLL_DIRECTION_DEADZONE || scrollY <= 0) {
        setShowCompact(false);
      }

      lastScrollYRef.current = scrollY;
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    }

    window.addEventListener("scroll", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [includeCompact]);

  function scrollToTop() {
    if (onBackToTop) {
      onBackToTop();
      return;
    }

    window.scrollTo({ behavior: "smooth", top: 0 });
  }

  if (!mounted) return null;

  return createPortal(
    <>
      {includeCompact ? (
        <button
          aria-label={t("timeline.backToTop")}
          className={`fixed left-1/2 z-30 grid size-10 -translate-x-1/2 place-items-center rounded-full border border-white/60 bg-white/75 text-[#75777d] shadow-lg shadow-slate-900/10 backdrop-blur-2xl transition-all duration-200 hover:bg-white/90 active:scale-95 lg:hidden ${
            showCompact && compactVisible
              ? "translate-y-0 opacity-100"
              : "pointer-events-none -translate-y-3 opacity-0"
          }`}
          onClick={scrollToTop}
          style={{ top: compactTop }}
          type="button"
        >
          <RocketIcon className="size-5" />
        </button>
      ) : null}

      <button
        aria-label={t("timeline.backToTop")}
        className={`fixed z-30 hidden size-14 place-items-center rounded-full border border-white/60 bg-white/75 text-[#75777d] shadow-lg shadow-slate-900/10 backdrop-blur-2xl transition-all duration-200 hover:bg-white/90 active:scale-95 lg:grid ${
          wideVisible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={scrollToTop}
        style={{ bottom: wideBottom, right: wideRight }}
        type="button"
      >
        <RocketIcon className="size-7" />
      </button>
    </>,
    document.body,
  );
}

function RocketIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.5c2.7 2.7 4 6.2 4 9.8 0 1.6-.3 3.1-1 4.7H9c-.7-1.6-1-3.1-1-4.7 0-3.6 1.3-7.1 4-9.8z" />
      <circle cx="12" cy="10" r="1.6" />
      <path d="M8 14.3 5.2 17v2.3l3-1.4" />
      <path d="M16 14.3 18.8 17v2.3l-3-1.4" />
      <path d="M9.7 18.5c0 1.4.9 3 2.3 3s2.3-1.6 2.3-3" />
    </svg>
  );
}
