"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { pushNavigationFrame, replaceNavigationFrame } from "@/components/navigation-history";
import {
  addSearchHistory,
  clearSearchHistory,
  readSearchHistory,
  SearchHistoryPopover,
} from "@/components/search-history";
import { IsbnScannerButton } from "@/components/isbn-scanner";
import { SearchSuggestionsPopover } from "@/components/search-suggestions";
import { SearchScopeSelect, type SearchScopeOption } from "@/components/search-scope-select";
import { useSearchFocusDismissal } from "@/components/use-search-focus-dismissal";
import { useT } from "@/components/use-t";
import { parseCatalogDetailPath, parseNeodbDetailPath } from "@/lib/catalog-link";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { CatalogFetchDialog, isSupportedCatalogLink } from "./catalog-fetch-dialog";

type SearchBarProps = {
  category: string;
  filters: SearchScopeOption[];
  onFocusStateChange?: (focused: boolean) => void;
  query: string;
};

export function SearchBar({
  category,
  filters,
  onFocusStateChange,
  query,
}: SearchBarProps) {
  const t = useT();
  const router = useRouter();
  const [currentQuery, setCurrentQuery] = useState(query);
  const [historyItems, setHistoryItems] = useState<string[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState<{
    message?: string;
    phase?: "form" | "working" | "success" | "error";
    skipForm?: boolean;
    url: string;
  } | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const searchRootRef = useRef<HTMLFormElement>(null);

  useSearchFocusDismissal({
    inputRef: searchInputRef,
    rootRef: searchRootRef,
    onDismiss: () => {
      setIsHistoryOpen(false);
      setIsSuggestionsOpen(false);
      onFocusStateChange?.(false);
    },
  });

  async function pushSearch(nextQuery: string, nextCategory: string) {
    const trimmedQuery = nextQuery.trim();

    if (!trimmedQuery) {
      return;
    }

    setHistoryItems(addSearchHistory(trimmedQuery));
    setIsHistoryOpen(false);
    setIsSuggestionsOpen(false);

    const neodbDetailPath = parseNeodbDetailPath(trimmedQuery);

    if (neodbDetailPath) {
      requestDetailScrollTopForHref(neodbDetailPath);
      pushNavigationFrame("detail", neodbDetailPath);
      router.push(neodbDetailPath);
      return;
    }

    if (isSupportedCatalogLink(trimmedQuery)) {
      const resolved = await resolveCatalogLink(trimmedQuery, nextCategory);

      if (resolved) {
        return;
      }
    }

    navigateToSearch(trimmedQuery, nextCategory);
  }

  function openSuggestedItem(item: { detailPath: string; title: string }) {
    setHistoryItems(addSearchHistory(item.title));
    setIsHistoryOpen(false);
    setIsSuggestionsOpen(false);
    requestDetailScrollTopForHref(item.detailPath);
    pushNavigationFrame("detail", item.detailPath);
    router.push(item.detailPath);
  }

  return (
    <form
      className="relative flex h-14 min-w-0 flex-1 items-center rounded-full border border-white/70 bg-white/60 p-2 shadow-lg shadow-slate-900/5 backdrop-blur-2xl"
      autoComplete="off"
      ref={searchRootRef}
      onSubmit={(event) => {
        event.preventDefault();
        void pushSearch(currentQuery, category);
      }}
    >
      <SearchScopeSelect
        onChange={(nextCategory) => void pushSearch(currentQuery, nextCategory)}
        options={filters}
        value={category}
      />
      <input
        autoCapitalize="none"
        autoComplete="off"
        autoCorrect="off"
        className="min-w-0 flex-1 bg-transparent px-4 text-base outline-none placeholder:text-[#75777d]"
        name="bielu-search-query"
        onChange={(event) => {
          const nextQuery = event.target.value;
          setCurrentQuery(nextQuery);

          if (nextQuery.trim()) {
            setIsHistoryOpen(false);
            setIsSuggestionsOpen(true);
          } else {
            setHistoryItems(readSearchHistory());
            setIsHistoryOpen(true);
            setIsSuggestionsOpen(false);
          }
        }}
        onFocus={() => {
          onFocusStateChange?.(true);
          setHistoryItems(readSearchHistory());
          if (currentQuery.trim()) {
            setIsSuggestionsOpen(true);
          } else {
            setIsHistoryOpen(true);
          }
        }}
        placeholder={t("search.placeholder")}
        ref={searchInputRef}
        spellCheck={false}
        type="text"
        value={currentQuery}
      />
      {currentQuery ? (
        <button
          aria-label={t("search.clear")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-[#75777d] transition hover:bg-white/60 hover:text-[#333e50] active:scale-95"
          onClick={() => {
            setCurrentQuery("");
            setHistoryItems(readSearchHistory());
            setIsHistoryOpen(true);
            setIsSuggestionsOpen(false);
            searchInputRef.current?.focus();
          }}
          onMouseDown={(event) => event.preventDefault()}
          type="button"
        >
          <ClearIcon />
        </button>
      ) : null}
      {!currentQuery.trim() ? (
        <IsbnScannerButton
          onDetected={(isbn) => {
            setCurrentQuery(isbn);
            void pushSearch(isbn, "book");
          }}
        />
      ) : null}
      {catalogDialog ? (
        <CatalogFetchDialog
          initialMessage={catalogDialog.message}
          initialPhase={catalogDialog.phase}
          initialUrl={catalogDialog.url}
          skipForm={catalogDialog.skipForm}
          onClose={() => setCatalogDialog(null)}
        />
      ) : null}
      {isHistoryOpen && !currentQuery.trim() ? (
        <SearchHistoryPopover
          clearLabel={t("search.clearRecentSearches")}
          ignoreRef={searchRootRef}
          items={historyItems}
          title={t("search.recentSearches")}
          onClear={() => {
            clearSearchHistory();
            setHistoryItems([]);
            setIsHistoryOpen(false);
          }}
          onClose={() => setIsHistoryOpen(false)}
          onSelect={(nextQuery) => {
            setCurrentQuery(nextQuery);
            void pushSearch(nextQuery, category);
          }}
        />
      ) : null}
      {currentQuery.trim() ? (
        <SearchSuggestionsPopover
          category={category}
          onClose={() => setIsSuggestionsOpen(false)}
          onSelect={openSuggestedItem}
          query={currentQuery}
          visible={isSuggestionsOpen}
        />
      ) : null}
    </form>
  );

  function navigateToSearch(nextQuery: string, nextCategory: string) {
    const params = new URLSearchParams({
      category: nextCategory,
    });

    if (nextQuery) {
      params.set("q", nextQuery);
    }

    const href = `/search?${params.toString()}`;
    replaceNavigationFrame("search", href);
    router.replace(href);
  }

  async function resolveCatalogLink(targetUrl: string, nextCategory: string) {
    try {
      const response = await fetch(
        `/api/neodb/catalog-fetch?url=${encodeURIComponent(targetUrl)}`,
        { cache: "no-store" },
      );
      const payload = (await response.json().catch(() => null)) as
        | {
            detailPath?: string;
            message?: string | null;
            url?: string;
          }
        | null;

      if (response.status === 302 && (payload?.detailPath || payload?.url)) {
        const href = payload.detailPath || parseCatalogDetailPath(payload.url || "");

        if (href) {
          requestDetailScrollTopForHref(href);
          pushNavigationFrame("detail", href);
          router.push(href);
          return true;
        }
      }

      if (response.status === 202) {
        setCatalogDialog({
          message: t("search.catalogFetch.workingHint"),
          phase: "working",
          skipForm: true,
          url: targetUrl,
        });
        return true;
      }

      navigateToSearch(targetUrl, nextCategory);
      return true;
    } catch {
      navigateToSearch(targetUrl, nextCategory);
      return true;
    }
  }
}

function ClearIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
