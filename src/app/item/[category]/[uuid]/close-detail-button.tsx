"use client";

import { useRouter } from "next/navigation";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { beginPress, isPrimaryPress } from "@/components/press-surface";

export function CloseDetailButton({
  onBeforeClose,
  pulseOnPress = false,
}: {
  onBeforeClose?: () => void;
  pulseOnPress?: boolean;
} = {}) {
  const router = useRouter();

  return (
    <button
      aria-label="返回首页"
      className={`grid size-10 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 disabled:cursor-default ${
        pulseOnPress ? "" : "press-icon"
      }`}
      onClick={(event) => {
        const button = event.currentTarget;

        button.disabled = true;
        onBeforeClose?.();
        performNavigationClose(resolveDetailCloseAction(), router);
      }}
      onPointerDown={(event) => {
        if (pulseOnPress && isPrimaryPress(event)) {
          beginPress(event.currentTarget.closest("[data-press-surface]"));
        }
      }}
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
