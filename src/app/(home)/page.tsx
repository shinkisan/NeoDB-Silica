import { Suspense } from "react";
import type { Metadata } from "next";
import { cookies } from "next/headers";
import { isCoverImageProxyEnabled } from "@/lib/cover-image";
import {
  FEATURED_COLLECTIONS_EMPTY_COOKIE,
  hasConfiguredFeaturedCollections,
} from "@/lib/featured-collections";
import {
  SITE_NAME,
  SITE_PRODUCT_DESCRIPTION,
  SITE_PRODUCT_TITLE,
  getIndexableRobots,
} from "@/lib/seo";
import HomeContentRoot from "../home-content";
import { HomeShellSkeleton } from "./home-shell-skeleton";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description: SITE_PRODUCT_DESCRIPTION,
  openGraph: {
    description: SITE_PRODUCT_DESCRIPTION,
    siteName: SITE_NAME,
    title: SITE_PRODUCT_TITLE,
    type: "website",
    url: "/",
  },
  robots: getIndexableRobots(),
  title: SITE_PRODUCT_TITLE,
  twitter: {
    card: "summary",
    description: SITE_PRODUCT_DESCRIPTION,
    title: SITE_PRODUCT_TITLE,
  },
};

export default async function HomePage() {
  const isCoverProxyEnabled = isCoverImageProxyEnabled();
  const cookieStore = await cookies();
  const featuredCollectionsEnabled =
    hasConfiguredFeaturedCollections() &&
    cookieStore.get(FEATURED_COLLECTIONS_EMPTY_COOKIE)?.value !== "1";

  return (
    <Suspense fallback={<HomeShellSkeleton />}>
      <HomeContentRoot
        featuredCollectionsEnabled={featuredCollectionsEnabled}
        isCoverProxyEnabled={isCoverProxyEnabled}
      />
    </Suspense>
  );
}
