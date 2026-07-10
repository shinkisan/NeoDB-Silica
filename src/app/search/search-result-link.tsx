"use client";

import Link from "next/link";
import { useEffect } from "react";
import { pushNavigationFrame } from "@/components/navigation-history";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const SEARCH_RESTORE_KEY = `${STORAGE_PREFIX}v1:search:restore`;
const SEARCH_LEAVING_KEY = `${STORAGE_PREFIX}v1:search:leaving`;
const SEARCH_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:search:scroll:`;

type SearchResultLinkProps = {
  children: React.ReactNode;
  className?: string;
  href: string;
};

export function SearchResultLink({
  children,
  className,
  href,
}: SearchResultLinkProps) {
  function saveSearchScroll() {
    const key = getSearchScrollKey(window.location.search.replace(/^\?/, ""));
    window.sessionStorage.setItem(key, String(window.scrollY));
    window.sessionStorage.setItem(SEARCH_LEAVING_KEY, "1");
    window.sessionStorage.setItem(SEARCH_RESTORE_KEY, "1");
    requestDetailScrollTopForHref(href);
    pushNavigationFrame("detail", href);
  }

  return (
    <Link
      className={className}
      href={href}
      onClick={saveSearchScroll}
      onPointerDown={saveSearchScroll}
    >
      {children}
    </Link>
  );
}

export function SearchScrollRestorer() {
  useEffect(() => {
    let frame = 0;

    function restoreIfNeeded() {
      if (window.sessionStorage.getItem(SEARCH_RESTORE_KEY) !== "1") {
        return;
      }

      const key = getSearchScrollKey(window.location.search.replace(/^\?/, ""));
      const storedScroll = Number(window.sessionStorage.getItem(key) || "0");

      if (storedScroll <= 0) {
        window.sessionStorage.removeItem(SEARCH_RESTORE_KEY);
        window.sessionStorage.removeItem(SEARCH_LEAVING_KEY);
        return;
      }

      let attempts = 0;
      const startedAt = performance.now();

      function restore() {
        const maxScroll = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const nextScroll = Math.min(storedScroll, maxScroll);
        window.scrollTo({ top: nextScroll, behavior: "instant" });
        attempts += 1;

        if (
          Math.abs(window.scrollY - nextScroll) <= 2 ||
          performance.now() - startedAt > 1800 ||
          attempts > 60
        ) {
          window.sessionStorage.removeItem(SEARCH_RESTORE_KEY);
          window.sessionStorage.removeItem(SEARCH_LEAVING_KEY);
          window.sessionStorage.setItem(key, String(window.scrollY));
          return;
        }

        frame = requestAnimationFrame(restore);
      }

      frame = requestAnimationFrame(restore);
    }

    restoreIfNeeded();
    window.addEventListener("focus", restoreIfNeeded);
    window.addEventListener("pageshow", restoreIfNeeded);
    window.addEventListener("popstate", restoreIfNeeded);
    document.addEventListener("visibilitychange", restoreIfNeeded);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("focus", restoreIfNeeded);
      window.removeEventListener("pageshow", restoreIfNeeded);
      window.removeEventListener("popstate", restoreIfNeeded);
      document.removeEventListener("visibilitychange", restoreIfNeeded);
    };
  }, []);

  return null;
}

function getSearchScrollKey(search: string) {
  return `${SEARCH_SCROLL_PREFIX}${search || "default"}`;
}
