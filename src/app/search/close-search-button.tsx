"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/use-t";
import {
  performNavigationClose,
  resolveSearchCloseAction,
} from "@/components/navigation-history";

export function CloseSearchButton({ tabIndex }: { tabIndex?: number }) {
  const t = useT();
  const router = useRouter();

  return (
    <button
      aria-label={t("search.close")}
      className="liquid-glass relative grid size-14 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-[#44474c] shadow-lg shadow-slate-900/5 transition hover:bg-white/80 hover:text-[#333e50]"
      onClick={() => {
        const page = document.querySelector("[data-search-page]");

        if (page) {
          page.classList.remove("search-page-exit");
          page.getBoundingClientRect();
          page.classList.add("search-page-exit");
        }

        window.setTimeout(() => {
          const action = resolveSearchCloseAction();
          performNavigationClose(action, router);
        }, 240);
      }}
      tabIndex={tabIndex}
      type="button"
    >
      <CloseIcon />
    </button>
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
