import { COOKIE_PREFIX } from "@/lib/runtime-ids";
import featuredCollections from "@/data/featured-collections.json";

/**
 * Set client-side once a fetch confirms none of the configured collections
 * resolve on this NeoDB instance (see `home-content.tsx`). Read server-side
 * here so the initial render already reflects it — avoiding both a visible
 * flash of the "lists" subtab and a hydration mismatch that a client-only
 * (e.g. localStorage-based) check would cause.
 */
export const FEATURED_COLLECTIONS_EMPTY_COOKIE = `${COOKIE_PREFIX}featured_collections_empty`;

/**
 * Whether this deployment has curated any featured collections. When false,
 * the home "lists" subtab and its rails are hidden entirely (see the
 * collection subtab gating in `home-content.tsx`) so a fresh instance that has
 * not curated homepage content shows no empty rails.
 */
export function hasConfiguredFeaturedCollections(): boolean {
  return featuredCollections.sections.some(
    (section) => section.collections.length > 0,
  );
}
