import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const SCROLL_TOP_ON_ENTRY_KEY = `${STORAGE_PREFIX}v1:scroll-top-on-entry`;

/**
 * Marks that the next page should start at its own top.
 *
 * A forward entry needs this: the browser keeps the offset it had and clamps it
 * onto the page being entered, which is still showing its loading skeleton — so
 * the visitor lands mid-page, and only gets to the top once the content has
 * grown enough for Next's own scroll reset to land. Entry points call this
 * before navigating; the target page consumes it with `ScrollTopOnEntry`.
 */
export function requestScrollTopOnEntry() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(SCROLL_TOP_ON_ENTRY_KEY, "1");
  } catch {
    // Without a session store the page simply starts where the browser put it,
    // which is how it behaved before.
  }
}

/** Reads and clears the mark, so it only affects the entry that set it. */
export function consumeScrollTopOnEntry() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const requested =
      window.sessionStorage.getItem(SCROLL_TOP_ON_ENTRY_KEY) === "1";

    window.sessionStorage.removeItem(SCROLL_TOP_ON_ENTRY_KEY);

    return requested;
  } catch {
    return false;
  }
}

const SCROLL_MEMORY_PREFIX = `${STORAGE_PREFIX}v1:scroll-memory:`;

/**
 * Remembers where a page was, for the row that is leaving it — the counterpart
 * of `requestScrollTopOnEntry` for the way back. `scope` names the page being
 * left, so several pages can keep their own position.
 */
export function rememberScroll(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.setItem(
      `${SCROLL_MEMORY_PREFIX}${scope}`,
      String(window.scrollY),
    );
  } catch {
    // Without a session store the page simply reopens at the top.
  }
}

/** Reads a remembered offset without clearing it, or null when there is none.
 * Reading without clearing keeps the restore idempotent: React may run the
 * effect twice, and the second run has to find the same offset. */
export function peekRememberedScroll(scope: string) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(
      `${SCROLL_MEMORY_PREFIX}${scope}`,
    );

    if (raw === null) {
      return null;
    }

    const offset = Number(raw);

    return Number.isFinite(offset) ? offset : null;
  } catch {
    return null;
  }
}

/** Drops a remembered offset: the page is being entered at its top instead. */
export function clearRememberedScroll(scope: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(`${SCROLL_MEMORY_PREFIX}${scope}`);
  } catch {
    // Nothing to clear if the store is unavailable.
  }
}
