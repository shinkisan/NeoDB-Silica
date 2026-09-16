"use client";

import { useRouter } from "next/navigation";
import {
  FloatingTopBar,
  TopBarIsland,
  TopBarTitle,
} from "@/components/floating-top-bar";
import { useEffect } from "react";
import { ActionMenu } from "@/components/action-menu";
import { showToast } from "@/components/app-toast";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { shareContent } from "@/lib/clipboard";
import { siteConfig } from "@/site.config";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const COLLECTION_SCROLL_TOP_PREFIX = `${STORAGE_PREFIX}v1:collection-scroll-top:`;
export const COLLECTION_RESTORE_PREFIX = `${STORAGE_PREFIX}v1:collection-restore:`;
export const COLLECTION_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:collection-scroll:`;

export function CollectionTopBar({
  contextKey,
  contextSelector,
  neodbUrl,
  showActions = true,
  title,
  uuid,
}: {
  contextKey?: string;
  contextSelector?: string;
  neodbUrl?: string;
  showActions?: boolean;
  title: string;
  uuid?: string;
}) {
  const router = useRouter();
  const t = useT();
  return (
    <FloatingTopBar className="fixed inset-x-0 top-0 z-[60]" rowClassName="max-w-2xl lg:max-w-4xl">
      <TopBarIsland>
        <button
          aria-label={t("collection.close")}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 press-icon disabled:cursor-default"
          onClick={(event) => {
            event.currentTarget.disabled = true;

            if (uuid) {
              navigator.sendBeacon(
                `/api/collection-cache?uuid=${encodeURIComponent(uuid)}`,
              );
            }

            performNavigationClose(resolveDetailCloseAction(), router);
          }}
          type="button"
        >
          <CloseIcon />
        </button>
      </TopBarIsland>
      <TopBarTitle
        contextKey={contextKey || `${uuid || "loading"}:${title}`}
        contextSelector={contextSelector}
        title={title || t("collection.title")}
      />
      {showActions ? (
        <TopBarIsland>
          <ActionMenu
            items={[
              {
                icon: <ShareIcon />,
                label: t("collection.share"),
                onClick: async () => {
                  try {
                    const shared = await shareContent({
                      url: window.location.href,
                    });
                    if (!shared) {
                      showToast(t("collection.copied"));
                    }
                  } catch {
                    showToast(t("collection.copyFailed"), "error");
                  }
                },
              },
              neodbUrl
                ? {
                    href: neodbUrl,
                    icon: <ExternalLinkMenuIcon />,
                    label: t("collection.openNeodb").replace("{server}", siteConfig.neodbName),
                  }
                : {
                    disabled: true,
                    icon: <ExternalLinkMenuIcon />,
                    label: t("collection.openNeodb").replace("{server}", siteConfig.neodbName),
                  },
            ]}
            label={t("collection.actions")}
          />
        </TopBarIsland>
      ) : (
        <div aria-hidden="true" className="size-10 shrink-0" />
      )}
    </FloatingTopBar>
  );
}

export function CollectionScrollTop({ uuid }: { uuid: string }) {
  useEffect(() => {
    if (window.sessionStorage.getItem(`${COLLECTION_RESTORE_PREFIX}${uuid}`) === "1") {
      return;
    }

    const key = `${COLLECTION_SCROLL_TOP_PREFIX}${uuid}`;

    if (window.sessionStorage.getItem(key) !== "1") {
      return;
    }

    window.sessionStorage.removeItem(key);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [uuid]);

  return null;
}

export function CollectionScrollRestorer({ page, uuid }: { page: number; uuid: string }) {
  useEffect(() => {
    const restoreKey = `${COLLECTION_RESTORE_PREFIX}${uuid}`;

    if (window.sessionStorage.getItem(restoreKey) !== "1") {
      return;
    }

    const scrollKey = getCollectionScrollKey(uuid, page);
    const storedScroll = Number(window.sessionStorage.getItem(scrollKey) || "0");

    if (storedScroll <= 0) {
      window.sessionStorage.removeItem(restoreKey);
      return;
    }

    let frame = 0;
    let attempts = 0;
    const startedAt = performance.now();
    const maxDuration = 1400;

    const finish = () => {
      window.sessionStorage.removeItem(restoreKey);
      window.sessionStorage.setItem(scrollKey, String(window.scrollY));
    };

    const restore = () => {
      const maxScroll = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight,
      );
      const nextScroll = Math.min(storedScroll, maxScroll);

      window.scrollTo({ top: nextScroll, behavior: "instant" });
      attempts += 1;

      if (
        Math.abs(window.scrollY - nextScroll) <= 2 ||
        performance.now() - startedAt > maxDuration ||
        attempts > 48
      ) {
        finish();
        return;
      }

      frame = requestAnimationFrame(restore);
    };

    frame = requestAnimationFrame(restore);

    return () => cancelAnimationFrame(frame);
  }, [page, uuid]);

  return null;
}

export function CollectionLoadingScrollTop() {
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return null;
}

function getCollectionScrollKey(uuid: string, page: number) {
  return `${COLLECTION_SCROLL_PREFIX}${uuid}:${page}`;
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

function ShareIcon() {
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
    </svg>
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
