"use client";

import { useEffect, useState } from "react";
import type { SearchScopeOption } from "@/components/search-scope-select";
import { CloseSearchButton } from "./close-search-button";
import { SearchBar } from "./search-bar";

type SearchTopBarProps = {
  category: string;
  filters: SearchScopeOption[];
  query: string;
};

export function SearchTopBar({ category, filters, query }: SearchTopBarProps) {
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [isCloseButtonSettled, setIsCloseButtonSettled] = useState(true);

  useEffect(() => {
    if (isSearchFocused) {
      setIsCloseButtonSettled(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsCloseButtonSettled(true);
    }, 320);

    return () => window.clearTimeout(timer);
  }, [isSearchFocused]);

  return (
    <div className="sticky top-4 z-40 mb-6 flex items-center gap-3 overflow-x-clip">
      <div className="min-w-0 flex-1 transition-[max-width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
        <SearchBar
          category={category}
          filters={filters}
          onFocusStateChange={setIsSearchFocused}
          query={query}
        />
      </div>
      <div
        aria-hidden={isSearchFocused}
        className={`grid transition-[max-width,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
          isSearchFocused
            ? "pointer-events-none max-w-0 translate-x-2 overflow-hidden opacity-0"
            : `max-w-16 translate-x-0 opacity-100 ${
                isCloseButtonSettled ? "overflow-visible" : "overflow-hidden"
              }`
        }`}
      >
        <CloseSearchButton tabIndex={isSearchFocused ? -1 : 0} />
      </div>
    </div>
  );
}
