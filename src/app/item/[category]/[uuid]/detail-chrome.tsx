"use client";

import { useRouter } from "next/navigation";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { useT } from "@/components/use-t";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActionMenu, type ActionMenuItem } from "@/components/action-menu";
import { showToast } from "@/components/app-toast";
import { pushNavigationFrame } from "@/components/navigation-history";
import { getStatusKey, getStatusTone, type ShelfType } from "@/components/mark-badges";
import type { RelatedLink } from "@/components/related-links-dialog";
import {
  MARKED_REFRESH_ITEM_EVENT,
  writeMarkedItemSnapshot,
} from "@/app/marked/marked-refresh";
import { copyText, shareContent } from "@/lib/clipboard";
import { invalidateMarkedListShelves } from "@/lib/marked-list-cache";
import {
  normalizeNeodbVisibility,
  type NeodbVisibility,
} from "@/lib/neodb-visibility";
import { invalidateTimelineCache } from "@/lib/timeline-cache";
import { readPublishPreferences } from "@/lib/publish-preferences";
import { siteConfig } from "@/site.config";
import {
  readReviewStateSnapshot,
  REVIEW_STATE_EVENT,
  type ReviewStateEvent,
  writeReviewStateSnapshot,
} from "@/lib/review-state";
import {
  DETAIL_COMMENT_LOCAL_EVENT,
  DETAIL_COMMENTS_REFRESH_EVENT,
  DETAIL_MARK_CACHE_PREFIX,
  DETAIL_MARK_EVENT,
  DETAIL_OPEN_SHORT_REVIEW_EVENT,
  type DetailCommentLocalEvent,
} from "./detail-state";
import {
  saveCurrentDetailScroll,
  saveDetailCommunityTab,
  saveDetailEditorReturn,
  saveDetailScroll,
} from "./detail-scroll-controls";
import { CloseDetailButton } from "./close-detail-button";

type DetailChromeProps = {
  category: string;
  closeOnly?: boolean;
  coverUrl?: string | null;
  externalResources?: ExternalResource[];
  isbn?: string | null;
  itemUuid: string;
  neodbUrl?: string | null;
  title: string;
  trackList?: string | null;
};

type ExternalResource = {
  kind?: "official_site";
  url?: string;
};

type RelatedLinkSite = {
  iconPath: string;
  label: string;
};

type MarkState = "loading" | "guest" | "unmarked" | "marked";
type MarkSnapshot = {
  commentText?: string;
  createdTime?: string;
  itemUuid: string;
  openShortReview?: boolean;
  ratingGrade?: number;
  shelfType: ShelfType | null;
  tags?: string[];
  visibility?: number;
};
export type DetailInitialMark = MarkSnapshot & {
  auth: "guest" | "ready";
};

const LazyAddToCollectionDialog = lazy(() =>
  import("./detail-tools-dialogs").then((module) => ({
    default: module.AddToCollectionDialog,
  })),
);
const LazyRelatedLinksDialog = lazy(() =>
  import("@/components/related-links-dialog").then((module) => ({
    default: module.RelatedLinksDialog,
  })),
);
const LazyTrackListDialog = lazy(() =>
  import("./detail-tools-dialogs").then((module) => ({
    default: module.TrackListDialog,
  })),
);
const LazyShortReviewDialog = lazy(() =>
  import("./short-review-dialog").then((module) => ({
    default: module.ShortReviewDialog,
  })),
);
const LazyMarkDateDialog = lazy(() =>
  import("./mark-date-dialog").then((module) => ({
    default: module.MarkDateDialog,
  })),
);

export function DetailTopBar({
  category,
  closeOnly = false,
  coverUrl,
  externalResources = [],
  isbn,
  itemUuid,
  neodbUrl,
  title,
  trackList,
}: DetailChromeProps) {
  const isViewerOpen = useImageViewerState();

  if (isViewerOpen) {
    return null;
  }

  return (
    <header
      className="border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl"
      style={{
        left: 0,
        position: "fixed",
        right: 0,
        top: 0,
        zIndex: 60,
      }}
    >
      <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <CloseDetailButton />
          {closeOnly ? null : (
            <TopBarItemSummary coverUrl={coverUrl} title={title} />
          )}
        </div>
        {closeOnly ? null : (
          <div className="flex shrink-0 items-center gap-1">
            <MarkMenu category={category} itemUuid={itemUuid} />
            <ItemToolsMenu
              category={category}
              externalResources={externalResources}
              isbn={isbn}
              itemUuid={itemUuid}
              neodbUrl={neodbUrl}
              title={title}
              trackList={trackList}
            />
          </div>
        )}
      </div>
    </header>
  );
}

function TopBarItemSummary({
  coverUrl,
  title,
}: {
  coverUrl?: string | null;
  title: string;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    function measureTitle() {
      const frame = frameRef.current;
      const titleNode = titleRef.current;

      if (!frame || !titleNode) {
        return;
      }

      setIsOverflowing(titleNode.scrollWidth > frame.clientWidth);
    }

    measureTitle();

    const observer = new ResizeObserver(measureTitle);

    if (frameRef.current) {
      observer.observe(frameRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [title]);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <div className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 bg-[#e2e2e5] shadow-sm">
        {coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={title}
            className="h-full w-full object-cover"
            src={coverUrl}
          />
        ) : (
          <span className="text-xs font-bold text-[#75777d]">B</span>
        )}
      </div>
      <div
        className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm font-bold text-[#1a1c1e]"
        ref={frameRef}
      >
        {isOverflowing ? (
          <span className="detail-title-marquee inline-flex">
            <span className="pr-6">{title}</span>
            <span aria-hidden="true" className="pr-6">
              {title}
            </span>
          </span>
        ) : (
          <span>{title}</span>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none invisible absolute whitespace-nowrap"
          ref={titleRef}
        >
          {title}
        </span>
      </div>
    </div>
  );
}

function MarkMenu({
  category,
  itemUuid,
}: {
  category: string;
  itemUuid: string;
}) {
  const t = useT();
  const markOptions = getMarkOptions(category).map((opt) => ({
    ...opt,
    label: t(getStatusKey(category, opt.shelfType)),
  }));
  const [isOpen, setIsOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState(t("mark.defaultLabel"));
  const [selectedShelfType, setSelectedShelfType] = useState<ShelfType | null>(
    null,
  );
  const [authState, setAuthState] =
    useState<"guest" | "ready">("ready");
  const [status, setStatus] = useState<"idle" | "saving" | "error" | "done">(
    "idle",
  );
  const [message, setMessage] = useState("");
  const [isDeleteMarkOpen, setIsDeleteMarkOpen] = useState(false);
  const [isMarkDateOpen, setIsMarkDateOpen] = useState(false);
  const [isMarkDateSaving, setIsMarkDateSaving] = useState(false);
  const [markDate, setMarkDate] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function closeOnOutsideClick(event: PointerEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
        event.preventDefault();
        event.stopPropagation();
      }
    }

    document.addEventListener("pointerdown", closeOnOutsideClick, true);

    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick, true);
    };
  }, [isOpen]);

  useEffect(() => {
    let cancelled = false;
    const cachedMark = readMarkCache(itemUuid);

    if (cachedMark) {
      window.queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setAuthState("ready");

        if (cachedMark.shelfType) {
          setSelectedLabel(t(getStatusKey(category, cachedMark.shelfType)));
          setSelectedShelfType(cachedMark.shelfType);
        } else {
          setSelectedLabel(t("mark.defaultLabel"));
          setSelectedShelfType(null);
        }
      });
    }

    fetch(`/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`)
      .then(async (response) => {
        if (response.status === 401) {
          return { auth: "guest" as const, shelfType: null };
        }

        if (!response.ok) {
          return { auth: "ready" as const, shelfType: null };
        }

        const payload = (await response.json()) as MarkSnapshot;
        return {
          auth: "ready" as const,
          createdTime: payload.createdTime || "",
          shelfType: payload.shelfType,
        };
      })
      .then((snapshot) => {
        if (cancelled) {
          return;
        }

        setAuthState(snapshot.auth);

        if (snapshot.shelfType) {
          setSelectedLabel(t(getStatusKey(category, snapshot.shelfType)));
          setSelectedShelfType(snapshot.shelfType);
          setMarkDate(toDateInputValue(snapshot.createdTime));
          writeMarkCache(itemUuid, snapshot.shelfType);
        } else {
          setSelectedLabel(t("mark.defaultLabel"));
          setSelectedShelfType(null);
          setMarkDate("");
          writeMarkCache(itemUuid, null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState("ready");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [category, itemUuid, t]);

  async function markItem(shelfType: ShelfType, label: string) {
    setStatus("saving");
    setMessage("");
    setIsOpen(false);
    const hasExistingMark = Boolean(selectedShelfType);
    const publishPreferences = readPublishPreferences();
    const markRequestBody = hasExistingMark
      ? {
          itemUuid,
          shelfType,
        }
      : {
          itemUuid,
          shelfType,
          visibility: publishPreferences.visibility.mark,
        };

    try {
      const response = await fetch("/api/neodb/mark", {
        body: JSON.stringify(markRequestBody),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<MarkSnapshot> & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "标记失败。");
      }

      const nextShelfType = payload?.shelfType || shelfType;
      const nextCommentText = payload?.commentText || "";
      const nextCreatedTime = payload?.createdTime || "";
      const nextRatingGrade = payload?.ratingGrade || 0;
      const nextTags = Array.isArray(payload?.tags) ? payload.tags : [];
      const nextVisibility = normalizeNeodbVisibility(payload?.visibility);

      if (selectedShelfType !== nextShelfType) {
        invalidateMarkedListShelves([selectedShelfType, nextShelfType]);
      }
      invalidateTimelineCache();
      setSelectedLabel(label);
      setSelectedShelfType(nextShelfType);
      setMarkDate(toDateInputValue(nextCreatedTime));
      writeMarkCache(itemUuid, nextShelfType);
      writeMarkedItemSnapshot({
        commentText: nextCommentText,
        createdTime: nextCreatedTime,
        itemUuid,
        ratingGrade: nextRatingGrade,
        shelfType: nextShelfType,
        tags: nextTags,
      });
      window.dispatchEvent(
        new CustomEvent<MarkSnapshot>(DETAIL_MARK_EVENT, {
          detail: {
            commentText: nextCommentText,
            createdTime: nextCreatedTime,
            itemUuid,
            ratingGrade: nextRatingGrade,
            shelfType: nextShelfType,
            tags: nextTags,
            visibility: nextVisibility,
          },
        }),
      );
      setStatus("done");
      setMessage(t("mark.success"));
      window.setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 1600);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "标记失败。");
    }
  }

  async function deleteMark() {
    setIsDeleteMarkOpen(false);
    setStatus("saving");

    try {
      const response = await fetch(
        `/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`,
        { method: "DELETE" },
      );

      if (!response.ok) {
        throw new Error("标记删除失败。");
      }

      invalidateMarkedListShelves([selectedShelfType]);
      invalidateTimelineCache();
      setSelectedLabel(t("mark.defaultLabel"));
      setSelectedShelfType(null);
      setMarkDate("");
      writeMarkCache(itemUuid, null);
      writeMarkedItemSnapshot({
        commentText: "",
        createdTime: "",
        itemUuid,
        ratingGrade: 0,
        shelfType: null,
        tags: [],
      });
      window.dispatchEvent(
        new CustomEvent<MarkSnapshot>(DETAIL_MARK_EVENT, {
          detail: {
            commentText: "",
            createdTime: "",
            itemUuid,
            ratingGrade: 0,
            shelfType: null,
            tags: [],
            visibility: undefined,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent<DetailCommentLocalEvent>(DETAIL_COMMENT_LOCAL_EVENT, {
          detail: {
            commentText: "",
            itemUuid,
            ratingGrade: 0,
            shelfType: null,
            tags: [],
            visibility: 0,
          },
        }),
      );
      window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
      setStatus("done");
      setMessage(t("mark.deleted"));
      window.setTimeout(() => {
        setStatus("idle");
        setMessage("");
      }, 1600);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "标记删除失败。");
    }
  }

  async function saveMarkDate(nextDate: string) {
    if (isMarkDateSaving) {
      return false;
    }

    setIsMarkDateSaving(true);

    try {
      const response = await fetch("/api/neodb/mark", {
        body: JSON.stringify({ itemUuid, markedDate: nextDate }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<MarkSnapshot> & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "标记时间保存失败。");
      }

      invalidateTimelineCache();

      const nextShelfType = payload?.shelfType || selectedShelfType;
      const nextCommentText = payload?.commentText || "";
      const nextCreatedTime = payload?.createdTime || "";
      const nextRatingGrade = payload?.ratingGrade || 0;
      const nextTags = Array.isArray(payload?.tags) ? payload.tags : [];
      const nextVisibility = normalizeNeodbVisibility(payload?.visibility);

      setMarkDate(toDateInputValue(nextCreatedTime));
      if (nextShelfType) {
        setSelectedShelfType(nextShelfType);
        setSelectedLabel(t(getStatusKey(category, nextShelfType)));
        writeMarkCache(itemUuid, nextShelfType);
      }
      writeMarkedItemSnapshot({
        commentText: nextCommentText,
        createdTime: nextCreatedTime,
        itemUuid,
        ratingGrade: nextRatingGrade,
        shelfType: nextShelfType,
        tags: nextTags,
      });
      window.dispatchEvent(
        new CustomEvent<MarkSnapshot>(DETAIL_MARK_EVENT, {
          detail: {
            commentText: nextCommentText,
            createdTime: nextCreatedTime,
            itemUuid,
            openShortReview: false,
            ratingGrade: nextRatingGrade,
            shelfType: nextShelfType,
            tags: nextTags,
            visibility: nextVisibility,
          },
        }),
      );
      window.dispatchEvent(
        new CustomEvent<{ itemUuid: string }>(MARKED_REFRESH_ITEM_EVENT, {
          detail: { itemUuid },
        }),
      );
      showToast(t("mark.dateSaved"));
      return true;
    } catch (error) {
      console.error("[mark] date save failed", error);
      showToast(t("mark.dateSaveError"), "error");
      return false;
    } finally {
      setIsMarkDateSaving(false);
    }
  }

  const isDisabled = status === "saving";
  const markButtonTone = selectedShelfType
    ? getStatusTone(selectedShelfType)
    : "border-[#c5c6cd] bg-white text-[#333e50] hover:bg-[#f3f3f6]";

  return (
    <div className="relative" ref={menuRef}>
      <button
        aria-expanded={isOpen}
        className={`mark-button-${selectedShelfType || "none"} inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-bold shadow-sm transition ${
          authState !== "ready"
            ? "cursor-not-allowed border-[#e2e2e5] bg-[#f0f0f2] text-[#a4a6ad] shadow-none"
            : `active:scale-[0.98] ${markButtonTone}`
        }`}
        disabled={isDisabled}
        onClick={() => {
          if (authState !== "ready") {
            showToast(t("mark.toast.needLoginMark"), "error");
            return;
          }

          setIsOpen((value) => !value);
        }}
        type="button"
      >
        <span>
          {status === "saving" ? t("mark.saving") : selectedLabel}
        </span>
        <ChevronDownIcon isOpen={isOpen} />
      </button>

      {isOpen ? (
        <div
          className="absolute right-0 top-12 min-w-32 w-max overflow-hidden rounded-2xl border border-[#e2e2e5] bg-white p-1 shadow-xl shadow-slate-900/10"
          role="listbox"
        >
          {markOptions.map((option) => {
            const isSelected = selectedLabel === option.label;

            return (
              <button
                aria-selected={isSelected}
                className={`flex h-9 w-full items-center justify-between rounded-xl px-3 text-sm font-semibold whitespace-nowrap transition ${
                  isSelected
                    ? "bg-[var(--theme-primary)] text-white"
                    : "text-[#44474c] hover:bg-[#e2e2e5]/70"
                }`}
                key={option.shelfType}
                onClick={() => markItem(option.shelfType, option.label)}
                role="option"
                type="button"
              >
                {option.label}
                {isSelected ? <CheckIcon /> : null}
              </button>
            );
          })}
          {selectedShelfType ? (
            <>
              <button
                className="flex h-9 w-full items-center rounded-xl px-3 text-sm font-semibold text-[#44474c] whitespace-nowrap transition hover:bg-[#e2e2e5]/70"
                onClick={() => {
                  setIsOpen(false);
                  setIsMarkDateOpen(true);
                }}
                type="button"
              >
                {t("mark.date")}
              </button>
              <button
                className="flex h-9 w-full items-center rounded-xl px-3 text-sm font-semibold text-red-600 whitespace-nowrap transition hover:bg-red-50"
                onClick={() => setIsDeleteMarkOpen(true)}
                type="button"
              >
                {t("mark.delete")}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div
          className={`absolute right-0 top-12 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold shadow-lg ${
            status === "error"
              ? "border-red-200 bg-red-50 text-red-900"
              : "border-[#b2ccc1]/60 bg-white/95 text-[#4c635b]"
          }`}
        >
          {message}
        </div>
      ) : null}

      {isDeleteMarkOpen ? (
        <ConfirmDialog
          confirmLabel={t("mark.delete")}
          description={t("mark.deleteDesc")}
          onCancel={() => setIsDeleteMarkOpen(false)}
          onConfirm={deleteMark}
          title={t("mark.deleteTitle")}
        />
      ) : null}
      {isMarkDateOpen ? (
        <Suspense fallback={null}>
          <LazyMarkDateDialog
            initialDate={markDate || getTodayDateInputValue()}
            onCancel={() => setIsMarkDateOpen(false)}
            onConfirm={saveMarkDate}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function ItemToolsMenu({
  category,
  externalResources,
  isbn,
  itemUuid,
  neodbUrl,
  title,
  trackList,
}: {
  category: string;
  externalResources: ExternalResource[];
  isbn?: string | null;
  itemUuid: string;
  neodbUrl?: string | null;
  title: string;
  trackList?: string | null;
}) {
  const t = useT();
  const router = useRouter();
  const [authState, setAuthState] =
    useState<"checking" | "guest" | "ready">("checking");
  const [isCollectionsOpen, setIsCollectionsOpen] = useState(false);
  const [isCheckingCollectionAuth, setIsCheckingCollectionAuth] = useState(false);
  const [isRelatedLinksOpen, setIsRelatedLinksOpen] = useState(false);
  const [isAvailabilityOpen, setIsAvailabilityOpen] = useState(false);
  const [isTrackListOpen, setIsTrackListOpen] = useState(false);
  const versionsHref = `/item/book/${encodeURIComponent(itemUuid)}/versions`;
  const creditsHref = `/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/credits`;
  const notesHref = `/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/notes`;
  const relatedLinks = getRelatedLinks(
    externalResources,
    category,
    t("detail.tools.officialSite"),
  );
  const podcastFeedLinks =
    category === "podcast" ? getPodcastFeedLinks(externalResources) : [];
  const availabilityLinks = getBookAvailabilityLinks(isbn);
  const tracks = parseTrackList(trackList);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/neodb/me", { cache: "no-store" })
      .then((response) =>
        response.status === 401 ? "guest" as const : "ready" as const,
      )
      .then((nextAuthState) => {
        if (cancelled) {
          return;
        }

        setAuthState(nextAuthState);
      })
      .catch(() => {
        if (!cancelled) {
          setAuthState("ready");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [itemUuid]);

  async function openCollectionsDialog() {
    if (isCheckingCollectionAuth) {
      return;
    }

    setIsCheckingCollectionAuth(true);

    try {
      const response = await fetch("/api/neodb/me", { cache: "no-store" });

      if (response.status === 401) {
        showToast(t("detail.tools.collectionLoginRequired"));
        return;
      }

      if (!response.ok) {
        showToast(t("detail.tools.collectionLoadError"), "error");
        return;
      }

      setIsCollectionsOpen(true);
    } catch {
      showToast(t("detail.tools.collectionLoadError"), "error");
    } finally {
      setIsCheckingCollectionAuth(false);
    }
  }

  function openWriteNote() {
    if (authState === "guest") {
      showToast(t("mark.toast.needLogin"), "error");
      return;
    }

    saveDetailScroll(itemUuid);
    saveDetailEditorReturn(itemUuid);
    router.push(`/item/${category}/${encodeURIComponent(itemUuid)}/note`);
  }

  function openMyNotes() {
    if (authState === "guest") {
      showToast(t("mark.toast.needLogin"), "error");
      return;
    }

    saveCurrentDetailScroll(itemUuid);
    pushNavigationFrame("detail", notesHref);
    router.push(notesHref);
  }

  const externalMenuItems: ActionMenuItem[] = [
    {
      icon: <ShareMenuIcon />,
      label: t("detail.tools.share"),
      onClick: async () => {
        try {
          const shared = await shareContent({ url: window.location.href });
          if (!shared) {
            showToast(t("detail.tools.copied"));
          }
        } catch {
          showToast(t("detail.tools.copyFailed"), "error");
        }
      },
    },
    neodbUrl
      ? {
          href: neodbUrl,
          icon: <ExternalLinkMenuIcon />,
          label: t("detail.tools.openNeodb").replace("{server}", siteConfig.neodbName),
        }
      : {
          disabled: true,
          icon: <ExternalLinkMenuIcon />,
          label: t("detail.tools.openNeodb").replace("{server}", siteConfig.neodbName),
        },
    ...(relatedLinks.length
      ? [
          {
            icon: <RelatedLinksMenuIcon />,
            label: t("detail.tools.relatedLinks"),
            onClick: () => setIsRelatedLinksOpen(true),
          },
        ]
      : []),
    ...(podcastFeedLinks.length
      ? [
          {
            icon: <RssFeedMenuIcon />,
            label: t("detail.tools.rssFeed"),
            onClick: async () => {
              try {
                await copyText(podcastFeedLinks[0].href);
                showToast(t("detail.tools.rssCopied"));
              } catch {
                showToast(t("detail.tools.copyFailed"), "error");
              }
            },
          },
        ]
      : []),
    ...(category === "book" && availabilityLinks.length
      ? [
          {
            icon: <AvailabilityMenuIcon />,
            label: t("detail.tools.availability"),
            onClick: () => setIsAvailabilityOpen(true),
          },
        ]
      : []),
  ];
  const contentMenuItems: ActionMenuItem[] = [
    {
      icon: <CollectionMenuIcon />,
      label: t("detail.tools.addToCollection"),
      onClick: openCollectionsDialog,
    },
    {
      disabled: authState === "checking",
      icon: <NoteMenuIcon />,
      label: t("detail.tools.writeNote"),
      onClick: openWriteNote,
    },
    {
      disabled: authState === "checking",
      icon: <NotebookMenuIcon />,
      label: t("detail.tools.myNotes"),
      onClick: openMyNotes,
    },
  ];
  const itemDataMenuItems: ActionMenuItem[] = [
    ...(category === "music" && tracks.length
      ? [
          {
            icon: <TrackListMenuIcon />,
            label: t("detail.tools.trackList"),
            onClick: () => setIsTrackListOpen(true),
          },
        ]
      : []),
    ...(category === "book"
      ? [
          {
            icon: <VersionsMenuIcon />,
            label: t("detail.tools.bookVersions"),
            onClick: () => {
              saveCurrentDetailScroll(itemUuid);
              pushNavigationFrame("detail", versionsHref);
              router.push(versionsHref);
            },
          },
        ]
      : []),
    ...(isCreditsCategory(category)
      ? [
          {
            icon: <CreditsMenuIcon />,
            label: t("detail.tools.credits"),
            onClick: () => {
              saveCurrentDetailScroll(itemUuid);
              pushNavigationFrame("detail", creditsHref);
              router.push(creditsHref);
            },
          },
        ]
      : []),
  ];
  const menuGroups = [externalMenuItems, contentMenuItems, itemDataMenuItems]
    .filter((group) => group.length > 0);
  const menuItems = menuGroups.flatMap((group, index) =>
    index === 0
      ? group
      : [{ key: `detail-tools-separator-${index}`, type: "separator" as const }, ...group],
  );

  return (
    <div className="relative">
      <ActionMenu
        items={menuItems}
        buttonClassName="size-8 -mr-4"
        label={t("detail.tools.label")}
      />
      {isCollectionsOpen ? (
        <Suspense fallback={null}>
          <LazyAddToCollectionDialog
            itemUuid={itemUuid}
            onClose={() => setIsCollectionsOpen(false)}
          />
        </Suspense>
      ) : null}
      {isRelatedLinksOpen ? (
        <Suspense fallback={null}>
          <LazyRelatedLinksDialog
            links={relatedLinks}
            onClose={() => setIsRelatedLinksOpen(false)}
            title={t("detail.tools.relatedLinks")}
          />
        </Suspense>
      ) : null}
      {isAvailabilityOpen ? (
        <Suspense fallback={null}>
          <LazyRelatedLinksDialog
            closeLabel={t("detail.tools.closeAvailability")}
            links={availabilityLinks}
            onClose={() => setIsAvailabilityOpen(false)}
            title={t("detail.tools.availability")}
          />
        </Suspense>
      ) : null}
      {isTrackListOpen ? (
        <Suspense fallback={null}>
          <LazyTrackListDialog
            title={title}
            tracks={tracks}
            onClose={() => setIsTrackListOpen(false)}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

export function ShortReviewFloatingButton({
  initialMark,
  itemUuid,
}: {
  initialMark?: DetailInitialMark | null;
  itemUuid: string;
}) {
  return (
    <DetailReviewActions
      initialMark={initialMark}
      itemUuid={itemUuid}
      mode="short"
      variant="floating"
    />
  );
}

function areSameTags(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((tag, index) => tag === right[index]);
}

function shouldOpenShortReviewAfterMark(shelfType: ShelfType | null) {
  return shelfType === "progress" || shelfType === "complete" || shelfType === "dropped";
}

function toDateInputValue(value?: string | null) {
  if (!value) {
    return "";
  }

  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value);

  return match?.[1] || "";
}

function getTodayDateInputValue() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function DetailReviewActions({
  category,
  initialMark,
  itemUuid,
  mode = "short",
  variant = "inline",
}: {
  category?: string;
  initialMark?: DetailInitialMark | null;
  itemUuid: string;
  mode?: "short" | "review";
  variant?: "floating" | "inline";
}) {
  const initialVisibility = normalizeNeodbVisibility(initialMark?.visibility);
  const initialTags = Array.isArray(initialMark?.tags) ? initialMark.tags : [];
  const [authState, setAuthState] = useState<"checking" | "guest" | "ready">(
    initialMark?.auth || "checking",
  );
  const [comment, setComment] = useState(initialMark?.commentText || "");
  const [draftComment, setDraftComment] = useState(
    initialMark?.commentText || "",
  );
  const [draftRating, setDraftRating] = useState(initialMark?.ratingGrade || 0);
  const [draftPostToFediverse, setDraftPostToFediverse] = useState(false);
  const [defaultPostToFediverse, setDefaultPostToFediverse] = useState(false);
  const [draftTags, setDraftTags] = useState<string[]>(initialTags);
  const [draftVisibility, setDraftVisibility] =
    useState<NeodbVisibility>(initialVisibility);
  const [isDiscardOpen, setIsDiscardOpen] = useState(false);
  const [isShortReviewOpen, setIsShortReviewOpen] = useState(false);
  const [hasReview, setHasReview] = useState(false);
  const [markState, setMarkState] = useState<MarkState>(
    initialMark
      ? initialMark.auth === "guest"
        ? "guest"
        : initialMark.shelfType
          ? "marked"
          : "unmarked"
      : "loading",
  );
  const [shelfType, setShelfType] = useState<ShelfType | null>(
    initialMark?.shelfType || null,
  );
  const markStateRef = useRef<MarkState>(markState);
  const openMoreRef = useRef(false);
  const openShortReviewFnRef = useRef<(openMore?: boolean) => void>(() => {});
  const [rating, setRating] = useState(initialMark?.ratingGrade || 0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [visibility, setVisibility] =
    useState<NeodbVisibility>(initialVisibility);
  const t = useT();
  const router = useRouter();

  useEffect(() => {
    markStateRef.current = markState;
  }, [markState]);

  useEffect(() => {
    function handleOpenShortReview(event: Event) {
      const detail = (event as CustomEvent<{ itemUuid: string; openMore?: boolean }>).detail;
      if (detail.itemUuid !== itemUuid) return;
      openShortReviewFnRef.current(detail.openMore ?? false);
    }
    window.addEventListener(DETAIL_OPEN_SHORT_REVIEW_EVENT, handleOpenShortReview);
    return () => window.removeEventListener(DETAIL_OPEN_SHORT_REVIEW_EVENT, handleOpenShortReview);
  }, [itemUuid]);

  useEffect(() => {
    let cancelled = false;

    if (!initialMark) {
      fetch(`/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`)
        .then(async (response) => {
          if (response.status === 401) {
            return {
              auth: "guest" as const,
              commentText: "",
              ratingGrade: 0,
              shelfType: null,
              tags: [],
              visibility: 0,
            };
          }

          if (!response.ok) {
            return {
              auth: "ready" as const,
              commentText: "",
              ratingGrade: 0,
              shelfType: null,
              tags: [],
              visibility: 0,
            };
          }

          const payload = (await response.json()) as MarkSnapshot;
          return {
            auth: "ready" as const,
            commentText: payload.commentText || "",
            ratingGrade: payload.ratingGrade || 0,
            shelfType: payload.shelfType,
            tags: Array.isArray(payload.tags) ? payload.tags : [],
            visibility: normalizeNeodbVisibility(payload.visibility),
          };
        })
        .then((mark) => {
          if (cancelled) {
            return;
          }

          const nextVisibility = normalizeNeodbVisibility(mark.visibility);

          setAuthState(mark.auth);
          setComment(mark.commentText);
          setDraftComment(mark.commentText);
          setDraftRating(mark.ratingGrade);
          setDraftTags(mark.tags);
          setDraftVisibility(nextVisibility);
          setMarkState(mark.auth === "guest" ? "guest" : mark.shelfType ? "marked" : "unmarked");
          setShelfType(mark.shelfType);
          setRating(mark.ratingGrade);
          setTags(mark.tags);
          setVisibility(nextVisibility);
        })
        .catch(() => {
          if (cancelled) {
            return;
          }

          setAuthState("ready");
          setMarkState("unmarked");
          setShelfType(null);
        });
    }

    function syncMark(event: Event) {
      const snapshot = (event as CustomEvent<MarkSnapshot>).detail;

      if (snapshot.itemUuid !== itemUuid) {
        return;
      }

      const nextComment = snapshot.commentText || "";
      const nextRating = snapshot.ratingGrade || 0;
      const nextTags = Array.isArray(snapshot.tags) ? snapshot.tags : [];
      const nextVisibility = normalizeNeodbVisibility(snapshot.visibility);

      setAuthState("ready");
      setMarkState(snapshot.shelfType ? "marked" : "unmarked");
      setShelfType(snapshot.shelfType);
      setComment(nextComment);
      setDraftComment(nextComment);
      setRating(nextRating);
      setDraftRating(nextRating);
      setTags(nextTags);
      setDraftTags(nextTags);
      setVisibility(nextVisibility);
      setDraftVisibility(nextVisibility);

      if (!snapshot.shelfType) {
        setIsShortReviewOpen(false);
        return;
      }

      if (snapshot.openShortReview !== false) {
        const shouldOpenShortReview = shouldOpenShortReviewAfterMark(
          snapshot.shelfType,
        );

        if (shouldOpenShortReview) {
          const nextPostToFediverse = nextComment.trim()
            ? false
            : readPublishPreferences().fediverse.comment;
          setDefaultPostToFediverse(nextPostToFediverse);
          setDraftPostToFediverse(nextPostToFediverse);
        }

        setIsShortReviewOpen(shouldOpenShortReview);
      }
    }

    window.addEventListener(DETAIL_MARK_EVENT, syncMark);

    return () => {
      cancelled = true;
      window.removeEventListener(DETAIL_MARK_EVENT, syncMark);
    };
  }, [initialMark, itemUuid]);

  useEffect(() => {
    if (mode !== "review") {
      return;
    }

    let cancelled = false;
    const cachedReviewState = readReviewStateSnapshot(itemUuid);

    if (cachedReviewState) {
      queueMicrotask(() => setHasReview(cachedReviewState.hasReview));
    }

    function applyReviewState(event: Event) {
      const snapshot = (event as ReviewStateEvent).detail;

      if (snapshot?.itemUuid === itemUuid) {
        setHasReview(snapshot.hasReview);
      }
    }

    fetch(`/api/neodb/review?itemUuid=${encodeURIComponent(itemUuid)}&summary=1`, {
      cache: "no-store",
    })
      .then((response) => {
        if (!cancelled) {
          const nextHasReview = response.ok;
          setHasReview(nextHasReview);
          writeReviewStateSnapshot({ hasReview: nextHasReview, itemUuid });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasReview(false);
        }
      });

    window.addEventListener(REVIEW_STATE_EVENT, applyReviewState);

    return () => {
      cancelled = true;
      window.removeEventListener(REVIEW_STATE_EVENT, applyReviewState);
    };
  }, [itemUuid, mode]);

  function requireLogin() {
    if (authState === "guest" || markState === "guest") {
      showToast(t("mark.toast.needLogin"), "error");
      return false;
    }

    return true;
  }

  function requireMarked(action: "rating" | "short") {
    if (!requireLogin()) {
      return false;
    }

    if (markState !== "marked") {
      const message =
        action === "rating"
          ? t("mark.toast.needMarkForRating")
          : t("mark.toast.needMarkForComment");

      showToast(message, "error");
      return false;
    }

    return true;
  }

  function openShortReview(openMore = false) {
    if (!requireMarked("short")) {
      return;
    }

    openMoreRef.current = openMore;
    setDraftComment(comment);
    setDraftRating(rating);
    const nextPostToFediverse = comment.trim()
      ? false
      : readPublishPreferences().fediverse.comment;
    setDefaultPostToFediverse(nextPostToFediverse);
    setDraftPostToFediverse(nextPostToFediverse);
    setDraftTags(tags);
    setDraftVisibility(visibility);
    setIsShortReviewOpen(true);
  }

  openShortReviewFnRef.current = openShortReview;

  function openLongReview() {
    if (!requireLogin()) {
      return;
    }

    if (!category) {
      showToast(t("detail.loadError"), "error");
      return;
    }

    saveDetailScroll(itemUuid);
    saveDetailEditorReturn(itemUuid);
    saveDetailCommunityTab(itemUuid, "reviews");
    router.push(`/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/review`);
  }

  function requestCloseShortReview() {
    if (
      draftComment !== comment ||
      draftRating !== rating ||
      draftPostToFediverse !== defaultPostToFediverse ||
      !areSameTags(draftTags, tags) ||
      draftVisibility !== visibility
    ) {
      setIsDiscardOpen(true);
      return;
    }

    setIsShortReviewOpen(false);
  }

  async function submitShortReview() {
    if (status === "saving") {
      return;
    }

    const hasContentChanges =
      draftComment.trim() !== comment.trim() ||
      draftRating !== rating ||
      !areSameTags(draftTags, tags);

    if (
      !hasContentChanges &&
      draftVisibility === visibility
    ) {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch("/api/neodb/mark", {
        body: JSON.stringify({
          commentText: draftComment.trim(),
          itemUuid,
          postToFediverse:
            draftPostToFediverse && Boolean(draftComment.trim()),
          ratingGrade: draftRating,
          tags: draftTags,
          visibility: draftVisibility,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | (Partial<MarkSnapshot> & { error?: string })
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || "保存失败。");
      }

      invalidateTimelineCache();

      const nextCreatedTime = payload?.createdTime || "";

      setComment(draftComment.trim());
      setRating(draftRating);
      setTags(draftTags);
      setVisibility(draftVisibility);
      writeMarkedItemSnapshot({
        commentText: draftComment.trim(),
        createdTime: nextCreatedTime,
        itemUuid,
        ratingGrade: draftRating,
        shelfType: payload?.shelfType || null,
        tags: draftTags,
      });
      setStatus("idle");
      setIsShortReviewOpen(false);
      showToast(comment ? t("shortReview.updated") : t("shortReview.saved"));
      window.dispatchEvent(
        new CustomEvent<DetailCommentLocalEvent>(DETAIL_COMMENT_LOCAL_EVENT, {
          detail: {
            commentText: draftComment.trim(),
            itemUuid,
            ratingGrade: draftRating,
            shelfType: payload?.shelfType || null,
            tags: draftTags,
            visibility: draftVisibility,
          },
        }),
      );
      window.dispatchEvent(new Event(DETAIL_COMMENTS_REFRESH_EVENT));
    } catch (error) {
      setStatus("error");
      showToast(error instanceof Error ? error.message : "保存失败。", "error");
    }
  }

  const canWriteReview = authState === "ready" && markState === "marked";
  const isLoadingState = authState === "checking" || markState === "loading";
  const isUnavailable = !canWriteReview && !isLoadingState;
  const shortReviewDialog = isShortReviewOpen ? (
    <Suspense fallback={null}>
      <LazyShortReviewDialog
        comment={comment}
        defaultMoreOpen={openMoreRef.current}
        draftComment={draftComment}
        defaultPostToFediverse={defaultPostToFediverse}
        draftPostToFediverse={draftPostToFediverse}
        draftRating={draftRating}
        draftTags={draftTags}
        draftVisibility={draftVisibility}
        isDiscardOpen={isDiscardOpen}
        onClose={requestCloseShortReview}
        onConfirmDiscard={() => {
          setDraftComment(comment);
          setDraftRating(rating);
          setDraftPostToFediverse(defaultPostToFediverse);
          setDraftTags(tags);
          setDraftVisibility(visibility);
          setIsDiscardOpen(false);
          setIsShortReviewOpen(false);
        }}
        onDraftCommentChange={setDraftComment}
        onDraftPostToFediverseChange={setDraftPostToFediverse}
        onDraftRatingChange={setDraftRating}
        onDraftTagsChange={setDraftTags}
        onDraftVisibilityChange={setDraftVisibility}
        onDiscardCancel={() => setIsDiscardOpen(false)}
        onSubmit={submitShortReview}
        rating={rating}
        showRating={shelfType !== "wishlist"}
        status={status}
        tags={tags}
        visibility={visibility}
      />
    </Suspense>
  ) : null;

  if (mode === "review") {
    const isReviewUnavailable = authState === "guest";

    return (
      <button
        aria-disabled={isReviewUnavailable}
        className={`inline-flex h-10 items-center rounded-full border border-[#c5c6cd] bg-white px-4 text-sm font-bold text-[#333e50] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[#a4a6ad] ${
          isReviewUnavailable
            ? "cursor-not-allowed text-[#a4a6ad]"
            : "hover:bg-[#f3f3f6]"
        }`}
        onClick={openLongReview}
        type="button"
      >
        {hasReview ? t("mark.actions.editReview") : t("mark.actions.writeReview")}
      </button>
    );
  }

  if (variant === "floating") {
    return (
      <>
        <button
          aria-disabled={isUnavailable || isLoadingState}
          aria-label={comment ? t("mark.actions.editComment") : t("mark.actions.writeComment")}
          className={`fixed bottom-7 right-5 z-[55] grid size-12 place-items-center rounded-full border border-white/60 bg-white/75 text-[#333e50] shadow-[0_18px_45px_rgba(26,28,30,0.28),0_4px_14px_rgba(26,28,30,0.16)] backdrop-blur-2xl transition active:scale-95 disabled:cursor-not-allowed disabled:text-[#a4a6ad] sm:bottom-8 sm:right-6 sm:size-14 lg:right-[max(1.25rem,calc(50vw-34rem))] ${
            isUnavailable ? "cursor-not-allowed text-[#a4a6ad]" : "hover:bg-white/90"
          }`}
          disabled={isLoadingState}
          onClick={() => openShortReview()}
          type="button"
        >
          <EditIcon />
        </button>
        {shortReviewDialog}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <button
          aria-disabled={isUnavailable || isLoadingState}
          className={`inline-flex h-10 items-center rounded-full border border-[#c5c6cd] bg-white px-4 text-sm font-bold text-[#333e50] shadow-sm transition active:scale-[0.98] disabled:cursor-not-allowed disabled:text-[#a4a6ad] ${
            isUnavailable ? "cursor-not-allowed text-[#a4a6ad]" : "hover:bg-[#f3f3f6]"
          }`}
          disabled={isLoadingState}
          onClick={() => openShortReview()}
          type="button"
        >
          {comment ? t("mark.actions.editComment") : t("mark.actions.writeComment")}
        </button>
      </div>
      {shortReviewDialog}
    </>
  );
}

function useImageViewerState() {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof document === "undefined") {
      return false;
    }

    return document.documentElement.dataset.imageViewerOpen === "true";
  });

  useEffect(() => {
    function syncFromDocument() {
      setIsOpen(document.documentElement.dataset.imageViewerOpen === "true");
    }

    function syncViewerState(event: Event) {
      setIsOpen(Boolean((event as CustomEvent<boolean>).detail));
    }

    syncFromDocument();
    window.addEventListener("app:image-viewer", syncViewerState);
    window.addEventListener("pageshow", syncFromDocument);
    window.addEventListener("focus", syncFromDocument);

    return () => {
      window.removeEventListener("app:image-viewer", syncViewerState);
      window.removeEventListener("pageshow", syncFromDocument);
      window.removeEventListener("focus", syncFromDocument);
    };
  }, []);

  return isOpen;
}

function getMarkOptions(category: string): Array<{
  label: string;
  shelfType: ShelfType;
}> {
  if (category === "game") {
    return [
      { label: "想玩", shelfType: "wishlist" },
      { label: "在玩", shelfType: "progress" },
      { label: "玩过", shelfType: "complete" },
      { label: "搁置", shelfType: "dropped" },
    ];
  }

  if (category === "movie" || category === "tv" || category === "performance") {
    return [
      { label: "想看", shelfType: "wishlist" },
      { label: "在看", shelfType: "progress" },
      { label: "看过", shelfType: "complete" },
      { label: "搁置", shelfType: "dropped" },
    ];
  }

  if (category === "music" || category === "podcast") {
    return [
      { label: "想听", shelfType: "wishlist" },
      { label: "在听", shelfType: "progress" },
      { label: "听过", shelfType: "complete" },
      { label: "搁置", shelfType: "dropped" },
    ];
  }

  return [
    { label: "想读", shelfType: "wishlist" },
    { label: "在读", shelfType: "progress" },
    { label: "读过", shelfType: "complete" },
    { label: "搁置", shelfType: "dropped" },
  ];
}

function EditIcon() {
  return <IconPath className="size-5 text-[#75777d] sm:size-6" path="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />;
}

function ChevronDownIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 shrink-0 transition ${isOpen ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m6 9 6 6 6-6" />
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

function RelatedLinksMenuIcon() {
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
      <path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1" />
      <path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1" />
    </svg>
  );
}

function RssFeedMenuIcon() {
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
      <path d="M4 11a9 9 0 0 1 9 9" />
      <path d="M4 4a16 16 0 0 1 16 16" />
      <circle cx="5" cy="19" r="1" />
    </svg>
  );
}

function CollectionMenuIcon() {
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
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1.5.86L12 16l-6.5 3.86A1 1 0 0 1 4 19Z" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  );
}

function AvailabilityMenuIcon() {
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
      <path d="M6 2h12l3 5v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z" />
      <path d="M3 7h18" />
      <path d="M16 11a4 4 0 0 1-8 0" />
    </svg>
  );
}

function NoteMenuIcon() {
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
      <path d="m14.5 4.5 5 5" />
      <path d="M4 15.5 14.5 5a2.1 2.1 0 0 1 3 0l1.5 1.5a2.1 2.1 0 0 1 0 3L8.5 20H4Z" />
      <path d="M4 20h16" />
      <path d="m7.5 14.5 2 2" />
    </svg>
  );
}

function NotebookMenuIcon() {
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
      <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
      <path d="M8 15h5" />
    </svg>
  );
}

function VersionsMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M6 4h11a2 2 0 0 1 2 2v13H8a3 3 0 0 0-3 3V6a2 2 0 0 1 2-2Z" />
      <path d="M8 18h11" />
      <path d="M9 8h6" />
      <path d="M9 12h4" />
    </svg>
  );
}

function CreditsMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function TrackListMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M9 6h12" />
      <path d="M9 12h12" />
      <path d="M9 18h12" />
      <path d="M4 6h.01" />
      <path d="M4 12h.01" />
      <path d="M4 18h.01" />
    </svg>
  );
}

function isCreditsCategory(category: string) {
  return (
    category === "movie" ||
    category === "tv" ||
    category === "tv-season" ||
    category === "tv-episode"
  );
}

function parseTrackList(trackList: string | null | undefined) {
  if (!trackList) {
    return [];
  }

  return trackList
    .split(/\r?\n/)
    .map((track) => track.trim())
    .filter(Boolean);
}

function getRelatedLinks(
  resources: ExternalResource[],
  category: string,
  officialSiteLabel: string,
) {
  const officialLinks = new Map<string, RelatedLink>();
  const links = new Map<string, RelatedLink>();

  for (const resource of resources) {
    if (!resource.url) {
      continue;
    }

    try {
      const url = new URL(resource.url);

      if (!/^https?:$/.test(url.protocol)) {
        continue;
      }

      const href = url.toString();

      if (links.has(href)) {
        continue;
      }

      if (category === "podcast") {
        if (isPodcastFeedUrl(url)) {
          continue;
        }

        const site = getPodcastExternalLinkSite(url);

        links.set(href, {
          href,
          iconPath: site.iconPath,
          label: site.label,
        });
        continue;
      }

      if (resource.kind === "official_site") {
        officialLinks.set(href, {
          href,
          iconPath: "/globe.svg",
          label: officialSiteLabel,
        });
        continue;
      }

      const site = getRelatedLinkSite(url);

      if (!site) {
        continue;
      }

      links.set(href, {
        href,
        iconPath: site.iconPath,
        label: site.label,
      });
    } catch {
      continue;
    }
  }

  return [...officialLinks.values(), ...links.values()];
}

function getPodcastFeedLinks(resources: ExternalResource[]) {
  const links = new Map<string, RelatedLink>();

  for (const resource of resources) {
    if (!resource.url) {
      continue;
    }

    try {
      const url = new URL(resource.url);

      if (!/^https?:$/.test(url.protocol) || !isPodcastFeedUrl(url)) {
        continue;
      }

      const href = url.toString();

      if (links.has(href)) {
        continue;
      }

      links.set(href, {
        href,
        iconPath: "/globe.svg",
        label: "RSS",
      });
    } catch {
      continue;
    }
  }

  return [...links.values()];
}

function isPodcastFeedUrl(url: URL) {
  const text = `${url.hostname}${url.pathname}`.toLowerCase();

  return (
    text.includes("feed") ||
    text.includes("rss") ||
    text.endsWith(".xml") ||
    text.endsWith(".atom")
  );
}

function getPodcastExternalLinkSite(url: URL): RelatedLinkSite {
  const host = getCleanHost(url.hostname);

  if (
    host === "podcasts.apple.com" ||
    (host.endsWith("apple.com") && url.pathname.toLowerCase().includes("podcast"))
  ) {
    return { iconPath: "/icons/external/apple.ico", label: "Apple Podcasts" };
  }

  if (host === "open.spotify.com" || host.endsWith("spotify.com")) {
    return { iconPath: "/icons/external/spotify.ico", label: "Spotify" };
  }

  if (host === "xiaoyuzhoufm.com" || host.endsWith(".xiaoyuzhoufm.com")) {
    return { iconPath: "/icons/external/xiaoyuzhou.ico", label: "小宇宙" };
  }

  return { iconPath: "/globe.svg", label: host || url.toString() };
}

function getBookAvailabilityLinks(isbn: string | null | undefined) {
  const normalizedIsbn = (isbn || "").replace(/[^0-9Xx]/g, "");

  if (!normalizedIsbn) {
    return [];
  }

  const encodedIsbn = encodeURIComponent(normalizedIsbn);
  return [
    {
      href: `https://www.worldcat.org/isbn/${encodedIsbn}`,
      iconPath: "/icons/external/worldcat.png",
      label: "WorldCat",
    },
    {
      href: `https://openlibrary.org/search?isbn=${encodedIsbn}`,
      iconPath: "/icons/external/openlibrary.png",
      label: "Open Library",
    },
    {
      href: `https://library.oapen.org/discover?filtertype_1=isbn&filter_relational_operator_1=equals&filter_1=${encodedIsbn}`,
      iconPath: "/icons/external/oapen.ico",
      label: "OAPEN",
    },
    {
      href: `https://bookshop.org/search?keywords=${encodedIsbn}`,
      iconPath: "/icons/external/bookshop.webp",
      label: "Bookshop.org",
    },
    {
      href: `https://www.amazon.com/s?k=${encodedIsbn}`,
      iconPath: "/icons/external/amazon.ico",
      label: "Amazon",
    },
    {
      href: `https://www.amazon.de/s?k=${encodedIsbn}`,
      iconPath: "/icons/external/amazon.ico",
      label: "Amazon DE",
    },
    {
      href: `https://www.amazon.co.jp/s?k=${encodedIsbn}`,
      iconPath: "/icons/external/amazon.ico",
      label: "Amazon JP",
    },
    {
      href: `https://www.amazon.co.uk/s?k=${encodedIsbn}`,
      iconPath: "/icons/external/amazon.ico",
      label: "Amazon UK",
    },
    {
      href: `https://www.kobo.com/search?query=${encodedIsbn}`,
      iconPath: "/icons/external/kobo.ico",
      label: "Kobo",
    },
    {
      href: `https://www.kobo.com/jp/en/search?query=${encodedIsbn}`,
      iconPath: "/icons/external/kobo.ico",
      label: "Kobo JP",
    },
    {
      href: `https://www.kobo.com/tw/zh/search?query=${encodedIsbn}`,
      iconPath: "/icons/external/kobo.ico",
      label: "Kobo TW",
    },
    {
      href: `https://www.kobo.com/us/en/search?query=${encodedIsbn}`,
      iconPath: "/icons/external/kobo.ico",
      label: "Kobo US",
    },
    {
      href: `https://www.duozhuayu.com/search/book/${encodedIsbn}`,
      iconPath: "/icons/external/duozhuayu.webp",
      label: "多抓鱼",
    },
    {
      href: `https://search.kongfz.com/product_result/?key=${encodedIsbn}`,
      iconPath: "/icons/external/kongfz.ico",
      label: "孔夫子旧书",
    },
    {
      href: `https://search.books.com.tw/search/query/key/${encodedIsbn}/cat/all`,
      iconPath: "/icons/external/books-tw.png",
      label: "博客来",
    },
    {
      href: `https://readmoo.com/search/keyword?q=${encodedIsbn}`,
      iconPath: "/icons/external/readmoo.ico",
      label: "Readmoo 读墨",
    },
  ];
}

function getCleanHost(hostname: string) {
  return hostname.replace(/^www\./, "");
}

function getRelatedLinkSite(url: URL): RelatedLinkSite | null {
  const host = getCleanHost(url.hostname);
  const sites: Array<[RegExp, RelatedLinkSite]> = [
    [/douban\.com$/, { iconPath: "/icons/external/douban.ico", label: "豆瓣" }],
    [/imdb\.com$/, { iconPath: "/icons/external/imdb.png", label: "IMDb" }],
    [/(themoviedb|tmdb)\.org$/, { iconPath: "/icons/external/tmdb.ico", label: "TMDB" }],
    [/wikipedia\.org$/, { iconPath: "/icons/external/wikipedia.ico", label: "Wikipedia" }],
    [/steam(powered)?\.com$/, { iconPath: "/icons/external/steam.ico", label: "Steam" }],
    [/steampowered\.com$/, { iconPath: "/icons/external/steam.ico", label: "Steam" }],
    [/goodreads\.com$/, { iconPath: "/icons/external/goodreads.ico", label: "Goodreads" }],
    [/spotify\.com$/, { iconPath: "/icons/external/spotify.ico", label: "Spotify" }],
    [/bangumi\.tv$/, { iconPath: "/icons/external/bangumi.ico", label: "Bangumi" }],
    [/bgm\.tv$/, { iconPath: "/icons/external/bangumi.ico", label: "Bangumi" }],
    [/musicbrainz\.org$/, { iconPath: "/icons/external/musicbrainz.ico", label: "MusicBrainz" }],
    [/discogs\.com$/, { iconPath: "/icons/external/discogs.png", label: "Discogs" }],
    [/openlibrary\.org$/, { iconPath: "/icons/external/openlibrary.png", label: "Open Library" }],
    [/books\.google\./, { iconPath: "/icons/external/google.ico", label: "Google Books" }],
    [/apple\.com$/, { iconPath: "/icons/external/apple.ico", label: "Apple" }],
    [/youtube\.com$/, { iconPath: "/icons/external/youtube.ico", label: "YouTube" }],
    [/youtu\.be$/, { iconPath: "/icons/external/youtube.ico", label: "YouTube" }],
  ];

  return sites.find(([pattern]) => pattern.test(host))?.[1] || null;
}

function ShareMenuIcon() {
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}

function CheckIcon() {
  return <IconPath className="size-4" path="m5 12 4 4L19 6" />;
}


function readMarkCache(itemUuid: string) {
  if (typeof window === "undefined") {
    return null;
  }

  const rawCache = window.localStorage.getItem(`${DETAIL_MARK_CACHE_PREFIX}${itemUuid}`);

  if (!rawCache) {
    return null;
  }

  try {
    const payload = JSON.parse(rawCache) as {
      shelfType?: ShelfType | null;
    };

    if (!payload.shelfType) {
      return { shelfType: null };
    }

    return { shelfType: payload.shelfType };
  } catch {
    window.localStorage.removeItem(`${DETAIL_MARK_CACHE_PREFIX}${itemUuid}`);
    return null;
  }
}

function writeMarkCache(itemUuid: string, shelfType: ShelfType | null) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    `${DETAIL_MARK_CACHE_PREFIX}${itemUuid}`,
    JSON.stringify({
      shelfType,
      updatedAt: Date.now(),
    }),
  );
}

function IconPath({ className = "size-5", path }: { className?: string; path: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d={path} />
    </svg>
  );
}
