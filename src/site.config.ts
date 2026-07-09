import type { ThemeColorId } from "@/lib/theme";

/**
 * Central, deployer-editable site configuration.
 *
 * This module holds the public brand identity of a deployment. It is safe to
 * import from both server and client components — it must never contain
 * secrets or read `process.env`. Runtime/deployment concerns (the NeoDB
 * instance URL, session secret, API keys, proxy) live in environment
 * variables instead; see `.env.example`.
 *
 * `name` is the single source of the deployment's brand name: it drives the
 * PWA manifest name, the page title, the desktop wordmark, and the About page
 * credit line, so changing it here updates all of them at once — there is no
 * separate per-locale "logo text" to keep in sync. Per-locale strings (the
 * app description, About page copy) still live in `src/messages/*.json` and
 * `about-page.tsx`.
 *
 * When deploying your own instance, edit the values below and replace the
 * brand assets referenced here (see `public/icons/`).
 */
export const siteConfig = {
  /** Canonical, non-localized site name used for SEO titles and metadata. */
  name: "Silica",
  /** Short product title used in Open Graph / Twitter cards. */
  productTitle: "Silica",
  /** One-line product description for SEO and social cards. */
  productDescription:
    "A third-party NeoDB PWA client for discovering and logging books, movies, TV, music, games, and more.",
  /**
   * Default public origin (scheme + host) of the deployment, used for
   * canonical URLs and social-card absolute paths. Left empty on purpose —
   * set your real origin with the `SITE_PUBLIC_ORIGIN` env var (or fill this
   * in directly). Falls back to `http://localhost:3000` when neither is set,
   * so local dev still works without configuring this.
   */
  publicOrigin: "",
  /**
   * Default theme color, picked from the same presets visitors can choose
   * from in Settings (`themeColors` in `src/lib/theme.ts`): "amber", "indigo",
   * "rose", "sage", or "slate". Applies to the PWA manifest, the browser
   * chrome color, and the app UI itself for any visitor who hasn't picked
   * their own color.
   */
  themeColorId: "slate" as ThemeColorId,
  /** PWA splash background color. */
  backgroundColor: "#f9f9fc",
  /**
   * Contact address for the in-app feedback link. Set to your own address, or
   * leave empty to hide the feedback entry point.
   */
  contactEmail: "",
  /**
   * Orientation of the decorative desktop wordmark shown next to the bottom
   * nav on large screens (see `DesktopLogo` in `bottom-nav.tsx`). "vertical"
   * stacks characters top-to-bottom with a CJK serif font — it suits the
   * original "「別錄.」" book-title-mark styling but reads poorly for Latin
   * scripts. Use "horizontal" for a plain, unrotated wordmark, which is the
   * better default for non-CJK site names.
   */
  logoOrientation: "horizontal" as "vertical" | "horizontal",
  /**
   * Display name for the connected NeoDB instance, used in UI copy such as
   * "Open in {neodbName}" / "View on {neodbName}". Distinct from `name` above
   * (this deployment's own brand) — set this if your NeoDB instance itself
   * has its own name distinct from the generic "NeoDB".
   */
  neodbName: "NeoDB",
} as const;

export type SiteConfig = typeof siteConfig;
