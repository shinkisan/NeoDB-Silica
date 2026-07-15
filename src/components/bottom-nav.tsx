"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { CSSProperties } from "react";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/components/use-t";
import {
  DEFAULT_HOME_CATEGORY,
  HOME_TAG_ORDER_KEY,
  homeTags,
  normalizeHomeTagOrder,
} from "@/lib/home-tags";
import { resetNavigationStackRoot } from "@/components/navigation-history";
import { siteConfig } from "@/site.config";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

type BottomTab = {
  href?: string;
  icon: React.ComponentType;
  label: string;
  match?: (path: string) => boolean;
};

const HOME_CATEGORY_KEY = `${STORAGE_PREFIX}v1:home:category`;
const HOME_LEAVING_KEY = `${STORAGE_PREFIX}v1:home:leaving`;
const HOME_RESTORE_KEY = `${STORAGE_PREFIX}v1:home:restore`;
const HOME_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:home:scroll:`;
const homeCategories = new Set(homeTags.map((tag) => tag.id));

let hasClearedHomeMemoryForPageLoad = false;
let hasPrefetchedRootLoadingShells = false;

export function BottomNav() {
  const t = useT();
  const pathname = usePathname();
  const router = useRouter();
  const [pendingIndex, setPendingIndex] = useState<number | null>(null);
  const [isPending, startTransition] = useTransition();
  const tabs: BottomTab[] = [
    {
      href: "/",
      icon: DiscoverIcon,
      label: t("bottomNav.discover"),
      match: (path: string) => path === "/",
    },
    {
      href: "/timeline",
      icon: TimelineIcon,
      label: t("bottomNav.timeline"),
      match: (path: string) => path.startsWith("/timeline"),
    },
    {
      href: "/marked",
      icon: MarkedIcon,
      label: t("bottomNav.marked"),
      match: (path: string) => path.startsWith("/marked"),
    },
    {
      href: "/profile",
      icon: ProfileIcon,
      label: t("bottomNav.profile"),
      match: (path: string) => path.startsWith("/profile"),
    },
  ];
  const shouldHide =
    pathname.startsWith("/profile/collections") ||
    pathname.startsWith("/profile/reviews") ||
    pathname.startsWith("/profile/tags") ||
    pathname.startsWith("/profile/followers") ||
    pathname.startsWith("/profile/following") ||
    pathname.startsWith("/timeline/notifications");
  const pathnameIndex = shouldHide
    ? -1
    : tabs.findIndex((tab) => tab.match?.(pathname));
  const activeIndex =
    isPending && pendingIndex !== null ? pendingIndex : pathnameIndex;

  useEffect(() => {
    if (hasClearedHomeMemoryForPageLoad) {
      return;
    }

    hasClearedHomeMemoryForPageLoad = true;

    const navigation = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    if (navigation?.type === "reload") {
      clearHomeNavigationMemory();
    }
  }, []);

  useEffect(() => {
    if (hasPrefetchedRootLoadingShells) {
      return;
    }

    hasPrefetchedRootLoadingShells = true;

    const prefetch = () => {
      if (pathname !== "/") {
        router.prefetch("/");
      }

      if (!pathname.startsWith("/marked")) {
        router.prefetch("/marked");
      }

      if (!pathname.startsWith("/timeline")) {
        router.prefetch("/timeline");
      }

      if (!pathname.startsWith("/profile")) {
        router.prefetch("/profile");
      }
    };

    if ("requestIdleCallback" in window) {
      const idleCallback = window.requestIdleCallback(prefetch, {
        timeout: 1800,
      });

      return () => window.cancelIdleCallback(idleCallback);
    }

    const timeout = globalThis.setTimeout(prefetch, 600);

    return () => globalThis.clearTimeout(timeout);
  }, [pathname, router]);

  if (shouldHide || activeIndex < 0) {
    return null;
  }

  return (
    <>
      <DesktopLogo />
      <nav className="pointer-events-none fixed inset-x-0 bottom-6 z-40 px-4 lg:inset-x-auto lg:bottom-auto lg:left-6 lg:top-1/2 lg:-translate-y-1/2 lg:px-0">
      <div
        className="liquid-glass relative pointer-events-auto mx-auto h-[62px] max-w-sm rounded-[2rem] border border-white/50 bg-white/55 p-1.5 shadow-2xl shadow-slate-900/10 lg:h-auto lg:w-[72px] lg:max-w-none"
        data-lg-depth="8"
        data-lg-strength="70"
        data-lg-cab="4"
      >
        <div
          className="relative grid h-[50px] grid-cols-4 lg:h-[280px] lg:grid-cols-1 lg:grid-rows-4"
          style={{ "--active-index": activeIndex } as CSSProperties}
        >
          <span
            aria-hidden="true"
            className="absolute inset-y-0 left-0 w-1/4 rounded-[1.65rem] bg-[var(--theme-primary)] shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] [transform:translateX(calc(var(--active-index)*100%))] lg:inset-x-0 lg:inset-y-auto lg:top-0 lg:h-1/4 lg:w-full lg:[transform:translateY(calc(var(--active-index)*100%))]"
          />
          {tabs.map((tab, index) => {
            const isActive = index === activeIndex;
            const Icon = tab.icon;
            const className = `relative z-10 flex h-[50px] flex-col items-center justify-center gap-0.5 rounded-[1.65rem] text-[11px] font-bold leading-none transition-colors duration-300 lg:h-[70px] ${
              isActive ? "text-white" : "text-[#44474c]"
            }`;
            const content = (
              <>
                <Icon />
                <span>{tab.label}</span>
              </>
            );

            if (tab.href) {
              const href = tab.href;

              return (
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                  href={href}
                  key={tab.label}
                  onClick={(event) => {
                    event.preventDefault();

                    if (isActive) {
                      window.scrollTo({ behavior: "smooth", top: 0 });
                      return;
                    }

                    const targetHref =
                      href === "/"
                        ? getStoredHomeHref()
                        : href === "/marked" && !pathname.startsWith("/marked")
                          ? getMarkedHref()
                          : href;
                    const stackRootHref = href === "/marked" ? "/marked" : targetHref;

                    if (href !== "/" && pathname === "/") {
                      saveCurrentHomeScroll();
                    }

                    setPendingIndex(index);
                    startTransition(() => {
                      resetNavigationStackRoot(stackRootHref);

                      if (href === "/") {
                        window.sessionStorage.setItem(HOME_RESTORE_KEY, "1");
                        router.push(targetHref, { scroll: false });
                        return;
                      }

                      router.push(targetHref);
                    });
                  }}
                >
                  {content}
                </Link>
              );
            }

            return (
              <button className={className} key={tab.label} type="button">
                {content}
              </button>
            );
          })}
        </div>
      </div>
      </nav>
    </>
  );
}

function getStoredHomeHref() {
  const category = window.sessionStorage.getItem(HOME_CATEGORY_KEY);
  const defaultCategory = getDefaultHomeCategory();

  if (!category || category === defaultCategory) {
    return "/";
  }

  return `/?category=${encodeURIComponent(category)}`;
}

function getMarkedHref() {
  return "/marked";
}

// Brand names here can be in any language, so instead of maintaining a
// curated font list (which only really covers one script well), both
// orientations just ask for the generic CSS "serif" family and let the
// browser/OS pick a script-appropriate serif font on its own.
function DesktopLogo() {
  const label = siteConfig.name;
  const cleanLabel = label.replace(/[「」.]/g, "");

  if (siteConfig.logoOrientation === "horizontal") {
    return (
      <div
        aria-label={label}
        className="pointer-events-none fixed left-6 top-7 z-40 hidden text-2xl font-semibold leading-none tracking-tight text-[#1a1c1e] lg:block"
        style={{ fontFamily: "serif" }}
      >
        {cleanLabel}
      </div>
    );
  }

  return (
    <div
      aria-label={label}
      className="pointer-events-none fixed left-[60px] top-7 z-40 hidden -translate-x-1/2 text-[2.25rem] font-semibold leading-none tracking-normal text-[#1a1c1e] lg:block"
      style={{
        fontFamily: "serif",
        textOrientation: "upright",
        writingMode: "vertical-rl",
      }}
    >
      {cleanLabel}
    </div>
  );
}

function clearHomeNavigationMemory() {
  window.sessionStorage.removeItem(HOME_CATEGORY_KEY);
  window.sessionStorage.removeItem(HOME_LEAVING_KEY);
  window.sessionStorage.removeItem(HOME_RESTORE_KEY);

  for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
    const key = window.sessionStorage.key(index);

    if (key?.startsWith(HOME_SCROLL_PREFIX)) {
      window.sessionStorage.removeItem(key);
    }
  }
}

function saveCurrentHomeScroll() {
  const category = getCurrentHomeCategory();

  window.sessionStorage.setItem(HOME_CATEGORY_KEY, category);
  window.sessionStorage.setItem(
    `${HOME_SCROLL_PREFIX}${category}`,
    String(window.scrollY),
  );
  window.sessionStorage.setItem(HOME_LEAVING_KEY, "1");
}

function getCurrentHomeCategory() {
  const defaultCategory = getDefaultHomeCategory();

  if (window.location.pathname !== "/") {
    return window.sessionStorage.getItem(HOME_CATEGORY_KEY) || defaultCategory;
  }

  const category =
    new URLSearchParams(window.location.search).get("category") ||
    defaultCategory;

  return homeCategories.has(category) ? category : defaultCategory;
}

function DiscoverIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8Z" />
    </svg>
  );
}

function MarkedIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 4h12a1 1 0 0 1 1 1v15l-7-4-7 4V5a1 1 0 0 1 1-1Z" />
      <path d="M9 8h6" />
    </svg>
  );
}

function TimelineIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M7 7.5h10M7 12h7" />
      <path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-7l-4.5 3v-3H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[22px] shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </svg>
  );
}

function getDefaultHomeCategory() {
  try {
    const order = normalizeHomeTagOrder(
      JSON.parse(window.localStorage.getItem(HOME_TAG_ORDER_KEY) || "[]"),
    );

    return order[0] || DEFAULT_HOME_CATEGORY;
  } catch {
    return DEFAULT_HOME_CATEGORY;
  }
}
