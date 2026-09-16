"use client";

import { useRouter } from "next/navigation";
import { useT } from "@/components/use-t";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import {
  performNavigationClose,
  resolveSearchCloseAction,
} from "@/components/navigation-history";
import { beginPress, isPrimaryPress } from "@/components/press-surface";

export function CloseSearchButton({ tabIndex }: { tabIndex?: number }) {
  const t = useT();
  const router = useRouter();

  return (
    <button
      ref={registerLiquidGlass}
      aria-label={t("search.close")}
      className="liquid-glass relative grid size-14 shrink-0 place-items-center rounded-full border border-white/70 bg-white/60 text-[#44474c] shadow-lg shadow-slate-900/5 transition hover:bg-white/80 hover:text-[#333e50] disabled:cursor-default"
      onClick={(event) => {
        event.currentTarget.disabled = true;
        performNavigationClose(resolveSearchCloseAction(), router);
      }}
      onPointerDown={(event) => {
        if (isPrimaryPress(event)) {
          beginPress(event.currentTarget);
        }
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
