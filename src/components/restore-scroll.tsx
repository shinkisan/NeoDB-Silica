"use client";

import { useEffect } from "react";
import {
  clearRememberedScroll,
  peekRememberedScroll,
} from "@/lib/page-scroll";

/** How long a restore may keep re-applying itself while the page grows. */
const RESTORE_WINDOW_MS = 3000;

/**
 * Renders nothing; puts the page back where it was left, when the row that
 * opened it remembered an offset (`rememberScroll`).
 *
 * `scope` is the page's own name, the same one its rows use.
 */
export function RestoreScroll({ scope }: { scope: string }) {
  useEffect(() => {
    // Read rather than read-and-clear: React runs effects twice in
    // development, and the second run has to find the offset again.
    const target = peekRememberedScroll(scope);

    if (target === null) {
      return;
    }

    // Held as a plain number: the closures below run later, where a narrowing
    // on a mutable binding would not survive.
    const offset: number = target;
    let stopped = false;
    let applied: number | null = null;
    let observer: ResizeObserver | null = null;
    let timeoutId = 0;

    function release() {
      observer?.disconnect();
      observer = null;
      window.clearTimeout(timeoutId);
      window.removeEventListener("wheel", onVisitorInput);
      window.removeEventListener("touchstart", onVisitorInput);
      window.removeEventListener("keydown", onVisitorInput);
      stopped = true;
    }

    /** Gives up on the restore, dropping the offset so it cannot go stale. */
    function finish() {
      if (stopped) {
        return;
      }

      release();
      clearRememberedScroll(scope);
    }

    // The visitor's own scrolling wins: a restore must not fight them.
    function onVisitorInput() {
      finish();
    }

    function attempt() {
      if (stopped) {
        return;
      }

      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const next = Math.min(offset, maxScroll);

      if (next !== applied) {
        applied = next;
        window.scrollTo({ behavior: "instant", top: next });
      }

      if (window.scrollY >= offset - 2) {
        release();
        clearRememberedScroll(scope);
      }
    }

    // The page streams in, so the saved offset only becomes reachable later.
    // Watching the page grow beats polling for it, and the offset is applied
    // again each time the reachable maximum changes.
    observer = new ResizeObserver(attempt);
    observer.observe(document.documentElement);
    timeoutId = window.setTimeout(finish, RESTORE_WINDOW_MS);
    window.addEventListener("wheel", onVisitorInput, { passive: true });
    window.addEventListener("touchstart", onVisitorInput, { passive: true });
    window.addEventListener("keydown", onVisitorInput);

    attempt();

    return release;
  }, [scope]);

  return null;
}
