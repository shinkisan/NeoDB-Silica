import type { MetadataRoute } from "next";
import {
  SITE_PUBLIC_ORIGIN,
  isSearchIndexingEnabled,
} from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!isSearchIndexingEnabled()) {
    return {
      rules: {
        disallow: "/",
        userAgent: "*",
      },
    };
  }

  return {
    host: SITE_PUBLIC_ORIGIN,
    rules: {
      allow: "/",
      disallow: "/api/",
      userAgent: "*",
    },
    sitemap: `${SITE_PUBLIC_ORIGIN}/sitemap.xml`,
  };
}
