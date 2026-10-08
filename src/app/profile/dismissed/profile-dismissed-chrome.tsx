"use client";

import { useRouter } from "next/navigation";
import { ActionMenu } from "@/components/action-menu";
import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";
import { useT } from "@/components/use-t";
import { siteConfig } from "@/site.config";

export function ProfileDismissedTopBar({
  neodbUrl,
  title,
}: {
  neodbUrl?: string | null;
  title: string;
}) {
  const router = useRouter();
  const t = useT();

  return (
    <FloatingTopBar
      className="fixed inset-x-0 top-0 z-[60]"
      rowClassName="max-w-2xl lg:max-w-4xl"
    >
      <TopBarIsland>
        <button
          aria-label={title}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 press-icon disabled:cursor-default"
          onClick={(event) => {
            event.currentTarget.disabled = true;
            router.push("/profile");
          }}
          type="button"
        >
          <CloseIcon />
        </button>
      </TopBarIsland>
      <p className="min-w-0 flex-1 truncate text-center text-base font-bold text-[var(--foreground)]">
        {title}
      </p>
      {neodbUrl ? (
        <TopBarIsland>
          <ActionMenu
            items={[
              {
                href: neodbUrl,
                icon: <ExternalLinkMenuIcon />,
                label: t("profile.dismissed.openNeodb").replace(
                  "{server}",
                  siteConfig.neodbName,
                ),
              },
            ]}
            label={t("profile.dismissed.actions")}
          />
        </TopBarIsland>
      ) : (
        <div aria-hidden="true" className="size-10 shrink-0" />
      )}
    </FloatingTopBar>
  );
}

function ExternalLinkMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
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
