/**
 * Persistent runtime identifier prefixes.
 *
 * ⚠️ These values are BRANCH-SPECIFIC and protected by `merge=ours` in
 * `.gitattributes` (together with `e2e/specs/runtime-ids.spec.ts`, which pins
 * them). On this public template they are the neutral "app" values; the
 * private product branch keeps its own historical prefixes so its live
 * deployment's cookies and stored preferences survive.
 *
 * Deployers: there is no need to rebrand these — they are internal wire
 * names, not user-visible text. If you do change them on an instance that
 * already has users, know that a cookie-prefix change signs everyone out and
 * a storage-prefix change discards visitors' saved preferences and caches.
 *
 * Only identifiers that persist in users' browsers belong here. Ephemeral
 * identifiers (custom event names, window globals, HTTP headers, DOM ids,
 * service-worker cache names) are plain "app"-prefixed literals in shared
 * code — renaming those never affects stored user state.
 */

/** Prefix for every localStorage/sessionStorage key the app writes. */
export const STORAGE_PREFIX = "app:";

/** Prefix for every cookie the app sets. */
export const COOKIE_PREFIX = "app_";
