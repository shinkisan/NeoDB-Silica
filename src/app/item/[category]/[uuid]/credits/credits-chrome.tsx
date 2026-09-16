"use client";

import { useRouter } from "next/navigation";
import {
  FloatingTopBar,
  TopBarIsland,
  TopBarTitle,
} from "@/components/floating-top-bar";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { useTopBarContextVisibility } from "@/components/use-top-bar-context-visibility";
import { useT } from "@/components/use-t";
import { TopBarAvatarButton } from "@/components/top-bar-avatar-button";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import topBarStyles from "@/components/floating-top-bar.module.css";

export function CreditsPersonTopBar({
  contextKey,
  contextSelector,
  name,
  profileUrl,
  showAvatar = true,
}: {
  contextKey: string;
  contextSelector?: string;
  name: string;
  profileUrl?: string | null;
  showAvatar?: boolean;
}) {
  const router = useRouter();
  const t = useT();
  const isAvatarVisible = useTopBarContextVisibility({
    contextKey,
    selector: contextSelector,
  });

  return (
    <header className={`${topBarStyles.bar} fixed inset-x-0 top-0 z-[60] px-4 sm:px-5`}>
      <div aria-hidden="true" className={topBarStyles.backdrop} />
      <div className="relative z-10 mx-auto flex h-16 max-w-2xl items-center justify-between gap-3 lg:max-w-4xl">
        <div
          className={`${topBarStyles.glassIsland} liquid-glass relative shrink-0 rounded-full border border-white/50`}
          data-lg-cab="2"
          data-lg-depth="4"
          data-lg-strength="34"
          ref={registerLiquidGlass}
        >
          <button
            aria-label={t("credits.closeWorks")}
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
        {showAvatar ? (
          <TopBarAvatarButton
            alt={name}
            fallback={name.slice(0, 1)}
            isVisible={isAvatarVisible}
            label={`${t("timeline.backToTop")} · ${name}`}
            src={profileUrl}
          />
        ) : null}
        <div aria-hidden="true" className="size-10 shrink-0" />
      </div>
    </header>
  );
}

export function CreditsTopBar({
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
    <FloatingTopBar className="fixed inset-x-0 top-0 z-[60]" rowClassName="max-w-2xl lg:max-w-4xl">
      <TopBarIsland>
        <button
          aria-label="关闭演职员页"
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 press-icon disabled:cursor-default"
          onClick={(event) => {
            event.currentTarget.disabled = true;
            performNavigationClose(resolveDetailCloseAction(), router);
          }}
          type="button"
        >
          <CloseIcon />
        </button>
      </TopBarIsland>
      <TopBarTitle
        contextKey={contextKey}
        contextSelector={contextSelector}
        title={title}
      />
      <div aria-hidden="true" className="size-10 shrink-0" />
    </FloatingTopBar>
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
