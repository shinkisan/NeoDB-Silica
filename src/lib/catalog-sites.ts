import {
  CATALOG_SITE_RULES,
  type CatalogSiteRule,
} from "./catalog-sites.generated.ts";

export type CatalogSiteMatch = {
  idType: string;
  siteName: string;
};

/** Python's `re.match` pins the start and ignores the rest, so anchoring the
 * pattern the same way is what makes our verdict agree with NeoDB's. The
 * wrapper is non-capturing, so a site's own `\1` references keep working. */
function toMatcher(pattern: string) {
  return new RegExp(`^(?:${pattern})`);
}

const rules = CATALOG_SITE_RULES.map((rule: CatalogSiteRule) => ({
  idType: rule.idType,
  primary: rule.patterns.map(toMatcher),
  secondary: (rule.fallbackPatterns ?? []).map(toMatcher),
  siteName: rule.siteName,
}));

/**
 * The site NeoDB would handle this URL with, or null when it supports none.
 *
 * Mirrors `SiteManager.get_class_by_url`: the first registered site whose
 * pattern matches wins, and the patterns that only a fallback validator
 * consults are tried after every site's primary patterns, also in registration
 * order. The fallback patterns are a superset — the real validators finish with
 * a network check (DNS, a page probe) or an instance-local list — so a match
 * here means "worth asking NeoDB about", not "certainly supported".
 */
export function matchCatalogSite(url: string): CatalogSiteMatch | null {
  for (const rule of rules) {
    if (rule.primary.some((pattern) => pattern.test(url))) {
      return { idType: rule.idType, siteName: rule.siteName };
    }
  }

  for (const rule of rules) {
    if (rule.secondary.some((pattern) => pattern.test(url))) {
      return { idType: rule.idType, siteName: rule.siteName };
    }
  }

  return matchFallbackOnlySite(url);
}

/**
 * Sites upstream accepts with no URL pattern at all, because their validator is
 * entirely network work: a page probe (itch), a feed parse (rss), a fediverse
 * JSON fetch (fedi). Only itch starts from a shape we can check offline; the
 * others keep going to keyword search, which is where they went before this
 * table existed, and the submit-link dialog still accepts them by hand.
 */
function matchFallbackOnlySite(url: string): CatalogSiteMatch | null {
  let host: string;

  try {
    host = new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }

  if (host === "itch.io" || host.endsWith(".itch.io")) {
    return { idType: "Itch", siteName: "Itch" };
  }

  return null;
}
