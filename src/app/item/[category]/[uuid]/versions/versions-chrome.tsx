"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  performNavigationClose,
  pushNavigationFrame,
  replaceNavigationFrame,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { PaginationPill } from "@/components/pagination-pill";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import { TopBarTitle } from "@/components/floating-top-bar";
import topBarStyles from "@/components/floating-top-bar.module.css";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { preserveVersionsScroll } from "./versions-scroll";

export const VERSIONS_PAGE_PENDING_EVENT = "app:versions-page-pending";

type VersionsPagePendingEvent = CustomEvent<{
  page: number;
}>;

export function VersionsTopBar({
  contextKey,
  contextSelector,
  title,
}: {
  contextKey?: string;
  contextSelector?: string;
  title: string;
}) {
  const router = useRouter();
  return (
    <header className={`${topBarStyles.bar} fixed inset-x-0 top-0 z-[60] px-4 sm:px-5`}>
      <div aria-hidden="true" className={topBarStyles.backdrop} />
      <div className="relative z-10 mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
        <div
          className={`${topBarStyles.glassIsland} liquid-glass relative shrink-0 rounded-full border border-white/50`}
          data-lg-cab="2"
          data-lg-depth="4"
          data-lg-strength="34"
          ref={registerLiquidGlass}
        >
          <button
            aria-label="关闭版本页"
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 press-icon disabled:cursor-default"
            onClick={(event) => {
              event.currentTarget.disabled = true;
              performNavigationClose(resolveDetailCloseAction(), router);
            }}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <TopBarTitle
          contextKey={contextKey}
          contextSelector={contextSelector}
          title={title}
        />
        <div aria-hidden="true" className="size-10 shrink-0" />
      </div>
    </header>
  );
}

export function VersionsPageLabel({
  count,
  countLabel,
  currentPage,
  pageLabel,
  pages,
}: {
  count: number;
  countLabel: string;
  currentPage: number;
  pageLabel: string;
  pages: number;
}) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const displayPage = pendingPage || currentPage;

  useEffect(() => {
    setPendingPage(null);
  }, [searchKey]);

  useEffect(() => {
    function handlePending(event: Event) {
      setPendingPage((event as VersionsPagePendingEvent).detail.page);
    }

    window.addEventListener(VERSIONS_PAGE_PENDING_EVENT, handlePending);

    return () => {
      window.removeEventListener(VERSIONS_PAGE_PENDING_EVENT, handlePending);
    };
  }, []);

  return (
    <div className="mt-1 flex items-center justify-between gap-4 text-sm font-semibold leading-6 text-[#75777d]">
      <span>{countLabel.replace("{count}", String(count))}</span>
      <span className="shrink-0 whitespace-nowrap">
        {pageLabel
          .replace("{page}", String(displayPage))
          .replace("{pages}", String(pages || 1))}
      </span>
    </div>
  );
}

export function VersionsContentFrame({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    setIsPending(false);
  }, [searchKey]);

  useEffect(() => {
    function handlePending() {
      setIsPending(true);
    }

    window.addEventListener(VERSIONS_PAGE_PENDING_EVENT, handlePending);

    return () => {
      window.removeEventListener(VERSIONS_PAGE_PENDING_EVENT, handlePending);
    };
  }, []);

  if (isPending) {
    return <VersionsItemsSkeleton />;
  }

  return children;
}

export function VersionItemLink({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  function openDetail() {
    preserveVersionsScroll();
    requestDetailScrollTopForHref(href);
    pushNavigationFrame("detail", href);
  }

  return (
    <Link href={href} onClick={openDetail} onPointerDown={openDetail}>
      {children}
    </Link>
  );
}

export function VersionsPagination({
  currentPage,
  pages,
}: {
  currentPage: number;
  pages: number;
}) {
  const router = useRouter();
  const [pendingPage, setPendingPage] = useState<number | null>(null);
  const activePage = pendingPage || currentPage;

  useEffect(() => {
    setPendingPage(null);
  }, [currentPage]);

  if (pages <= 1) {
    return null;
  }

  return (
    <div className="mt-6 flex justify-center">
      <PaginationPill
        activePage={activePage}
        onPageChange={(page) => {
          if (page < 1 || page > pages || page === currentPage) {
            return;
          }

          const url = new URL(window.location.href);
          url.searchParams.set("page", String(page));
          const href = `${url.pathname}${url.search}`;
          setPendingPage(page);
          window.dispatchEvent(
            new CustomEvent(VERSIONS_PAGE_PENDING_EVENT, {
              detail: { page },
            }),
          );
          replaceNavigationFrame("detail", href);
          router.replace(href);
          window.scrollTo({ top: 0, behavior: "instant" });
        }}
        pages={pages}
      />
    </div>
  );
}

function VersionsItemsSkeleton() {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 5 }, (_, index) => (
        <article
          className="overflow-hidden rounded-xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5"
          key={index}
        >
          <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 sm:grid-cols-[104px_minmax(0,1fr)]">
            <div className="aspect-[3/4] animate-pulse rounded-lg bg-[#e2e2e5]" />
            <div className="space-y-3 py-1">
              <div className="h-5 w-3/4 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-1/2 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-6 w-32 animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-full animate-pulse rounded-full bg-[#e2e2e5]" />
              <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
            </div>
          </div>
        </article>
      ))}
    </section>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
