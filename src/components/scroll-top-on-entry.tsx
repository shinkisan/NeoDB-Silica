"use client";

import { useLayoutEffect } from "react";
import {
  clearRememberedScroll,
  consumeScrollTopOnEntry,
} from "@/lib/page-scroll";

/**
 * Renders nothing; puts the page at its top when the entry that opened it asked
 * for that, and drops any position remembered for this page — an entry that
 * asks for the top is not a return.
 *
 * `scope` is the page's own name, matching the one its rows use for
 * `rememberScroll` and what `RestoreScroll` reads.
 */
export function ScrollTopOnEntry({ scope }: { scope: string }) {
  // Layout, not a passive effect: the browser has already clamped the previous
  // offset onto this page by the time it paints, so the reset has to land in the
  // same commit to be invisible.
  useLayoutEffect(() => {
    if (!consumeScrollTopOnEntry()) {
      return;
    }

    clearRememberedScroll(scope);
    window.scrollTo({ behavior: "instant", top: 0 });
  }, [scope]);

  return null;
}
