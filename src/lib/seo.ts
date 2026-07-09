import type { Metadata } from "next";
import { siteConfig } from "@/site.config";

export const BIELU_SITE_NAME = siteConfig.name;

const configuredPublicOrigin =
  process.env.SITE_PUBLIC_ORIGIN?.trim() || siteConfig.publicOrigin;

// Without a real origin, canonical URLs, the sitemap, and robots.txt would
// all silently point at localhost in production — refuse to boot rather than
// serve that. Development falls back to localhost so `npm run dev` still
// works with no configuration.
if (process.env.NODE_ENV === "production" && !configuredPublicOrigin) {
  throw new Error(
    "[seo] Set SITE_PUBLIC_ORIGIN (or site.config.ts's publicOrigin) in " +
      "production so canonical URLs and the sitemap don't point at localhost.",
  );
}

export const SITE_PUBLIC_ORIGIN = normalizeOrigin(
  configuredPublicOrigin || "http://localhost:3000",
);
export const BIELU_PRODUCT_TITLE = siteConfig.productTitle;
export const BIELU_PRODUCT_DESCRIPTION = siteConfig.productDescription;

export function isSearchIndexingEnabled() {
  return (
    process.env.VERCEL_ENV === "production" ||
    process.env.BIELU_ALLOW_INDEXING === "1"
  );
}

export function getIndexableRobots(): Metadata["robots"] {
  if (!isSearchIndexingEnabled()) {
    return getNoIndexRobots();
  }

  return {
    follow: true,
    index: true,
    googleBot: {
      follow: true,
      index: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  };
}

export function getNoIndexRobots(): Metadata["robots"] {
  return {
    follow: true,
    index: false,
    googleBot: {
      follow: true,
      index: false,
    },
  };
}

export function getSiteVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION?.trim();
  const bing = process.env.BING_SITE_VERIFICATION?.trim();

  return {
    ...(google ? { google } : {}),
    ...(bing ? { other: { "msvalidate.01": bing } } : {}),
  };
}

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//.test(value) ? value : `https://${value}`;

  return new URL(withProtocol).origin;
}
