import type { MetadataRoute } from "next";
import {
  SITE_PUBLIC_ORIGIN,
  isSearchIndexingEnabled,
} from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  if (!isSearchIndexingEnabled()) {
    return [];
  }

  const aboutLanguages = {
    en: `${SITE_PUBLIC_ORIGIN}/en/about`,
    "x-default": `${SITE_PUBLIC_ORIGIN}/about`,
    "zh-Hans": `${SITE_PUBLIC_ORIGIN}/about`,
    "zh-Hant": `${SITE_PUBLIC_ORIGIN}/zh-Hant/about`,
  };

  return [
    {
      changeFrequency: "weekly",
      priority: 1,
      url: SITE_PUBLIC_ORIGIN,
    },
    {
      changeFrequency: "monthly",
      alternates: { languages: aboutLanguages },
      priority: 0.9,
      url: `${SITE_PUBLIC_ORIGIN}/about`,
    },
    {
      changeFrequency: "monthly",
      alternates: { languages: aboutLanguages },
      priority: 0.9,
      url: `${SITE_PUBLIC_ORIGIN}/zh-Hant/about`,
    },
    {
      changeFrequency: "monthly",
      alternates: { languages: aboutLanguages },
      priority: 0.9,
      url: `${SITE_PUBLIC_ORIGIN}/en/about`,
    },
  ];
}
