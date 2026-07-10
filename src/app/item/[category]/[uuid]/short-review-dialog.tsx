"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Dropdown } from "@/components/dropdown";
import { PublishSwitch } from "@/components/publish-switch";
import { useT } from "@/components/use-t";
import {
  normalizeNeodbVisibility,
  type NeodbVisibility,
} from "@/lib/neodb-visibility";

export function ShortReviewDialog({
  comment,
  defaultMoreOpen,
  defaultPostToFediverse,
  draftComment,
  draftPostToFediverse,
  draftRating,
  draftTags,
  draftVisibility,
  isDiscardOpen,
  onClose,
  onConfirmDiscard,
  onDraftCommentChange,
  onDraftPostToFediverseChange,
  onDraftRatingChange,
  onDraftTagsChange,
  onDraftVisibilityChange,
  onDiscardCancel,
  onSubmit,
  rating,
  showRating,
  status,
  tags,
  visibility,
}: {
  comment: string;
  defaultMoreOpen?: boolean;
  defaultPostToFediverse: boolean;
  draftComment: string;
  draftPostToFediverse: boolean;
  draftRating: number;
  draftTags: string[];
  draftVisibility: NeodbVisibility;
  isDiscardOpen: boolean;
  onClose: () => void;
  onConfirmDiscard: () => void;
  onDraftCommentChange: (value: string) => void;
  onDraftPostToFediverseChange: (value: boolean) => void;
  onDraftRatingChange: (value: number) => void;
  onDraftTagsChange: (value: string[]) => void;
  onDraftVisibilityChange: (value: NeodbVisibility) => void;
  onDiscardCancel: () => void;
  onSubmit: () => void;
  rating: number;
  showRating: boolean;
  status: "idle" | "saving" | "error";
  tags: string[];
  visibility: NeodbVisibility;
}) {
  const [isDraggingRating, setIsDraggingRating] = useState(false);
  const [isMoreOpen, setIsMoreOpen] = useState(defaultMoreOpen ?? false);
  const [isTagDialogOpen, setIsTagDialogOpen] = useState(false);
  const [myTags, setMyTags] = useState<MyTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("__new__");
  const [tagInput, setTagInput] = useState("");
  const [tagLoadStatus, setTagLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [isVisibilityOpen, setIsVisibilityOpen] = useState(false);
  const commentTextareaRef = useRef<HTMLTextAreaElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);
  const isKeyboardOpen = useVisualKeyboardOpen();
  const t = useT();
  const tagOptions = [
    { id: "__new__", label: t("detail.hashtags.createTag") },
    ...myTags.map((entry) => ({ id: entry.uuid, label: entry.title })),
  ];
  const isCreatingTag = selectedTagId === "__new__";
  const canPostToFediverse = Boolean(draftComment.trim());
  const hasContentChanges =
    draftComment.trim() !== comment.trim() ||
    draftRating !== rating ||
    !areSameTags(draftTags, tags);
  const hasSubmittableChanges =
    hasContentChanges || draftVisibility !== visibility;
  const hasMoreChanges =
    draftPostToFediverse !== defaultPostToFediverse ||
    draftVisibility !== visibility ||
    !areSameTags(draftTags, tags);

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/neodb/tags", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || t("detail.hashtags.tagsLoadError"));
        }

        return (await response.json()) as { items?: MyTag[] };
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setMyTags(Array.isArray(payload.items) ? payload.items : []);
        setTagLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setTagLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  useEffect(() => {
    if (!isTagDialogOpen || !isCreatingTag) {
      return;
    }

    window.setTimeout(() => tagInputRef.current?.focus(), 80);
  }, [isCreatingTag, isTagDialogOpen]);

  function addDraftTag() {
    const selectedTag = myTags.find((entry) => entry.uuid === selectedTagId);
    const nextTags = isCreatingTag
      ? parseTagInput(tagInput)
      : [normalizeTagInput(selectedTag?.title || "")].filter(Boolean);

    if (!nextTags.length) {
      showToast(
        isCreatingTag ? t("detail.hashtags.empty") : t("detail.hashtags.selectTag"),
        "error",
      );
      return;
    }

    const uniqueTags = nextTags.filter((tag, index) => {
      if (hasTag(draftTags, tag)) {
        return false;
      }

      return !nextTags.slice(0, index).some((value) => hasTag([value], tag));
    });

    if (!uniqueTags.length) {
      showToast(t("detail.hashtags.duplicate"), "error");
      return;
    }

    onDraftTagsChange([...draftTags, ...uniqueTags]);
    setTagInput("");
    setSelectedTagId("__new__");
    setIsTagDialogOpen(false);
    setIsMoreOpen(true);
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[80] flex items-center justify-center bg-[#e2e2e5]/55 px-5 backdrop-blur-sm ${
        isKeyboardOpen
          ? "pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3"
          : "pb-5 pt-5"
      }`}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget && !isDiscardOpen) {
          event.preventDefault();
          event.stopPropagation();
          setIsTagDialogOpen(false);
          setIsVisibilityOpen(false);
        }
      }}
    >
      <div
        className={`review-editor-enter w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl ${
          isKeyboardOpen
            ? "max-h-[calc(100dvh_-_1rem_-_env(safe-area-inset-bottom))]"
            : "max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] sm:max-h-[calc(100dvh_-_2.5rem)]"
        }`}
      >
        <header className="flex items-center justify-between gap-4 pb-2">
          <h3 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
            {comment || rating ? t("shortReview.editTitle") : t("shortReview.writeTitle")}
          </h3>
          <button
            aria-label={t("shortReview.close")}
            className="grid size-10 shrink-0 place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        {showRating ? (
          <section className="flex justify-center py-3">
            <div
              className="flex touch-none gap-1 text-[#333e50]"
              onPointerCancel={() => setIsDraggingRating(false)}
              onPointerLeave={() => setIsDraggingRating(false)}
              onPointerMove={(event) => {
                if (isDraggingRating) {
                  onDraftRatingChange(getRatingFromRatingRow(event));
                }
              }}
              onPointerUp={() => setIsDraggingRating(false)}
            >
              {Array.from({ length: 5 }, (_, index) => {
                const fill = getStarFill(draftRating, index);

                return (
                  <button
                    aria-label={`${index + 1} 星`}
                    className="grid size-11 place-items-center rounded-2xl transition hover:bg-white/70 active:scale-95"
                    key={index}
                    onClick={(event) => {
                      onDraftRatingChange(getRatingFromPointer(event, index));
                    }}
                    onPointerDown={(event) => {
                      setIsDraggingRating(true);
                      onDraftRatingChange(getRatingFromPointer(event, index));
                    }}
                    type="button"
                  >
                    <RatingStar fill={fill} />
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

        <textarea
          className="min-h-28 w-full resize-none rounded-[1.5rem] border border-white/60 bg-white/45 p-4 text-base leading-7 text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd] sm:min-h-36"
          onChange={(event) => onDraftCommentChange(event.target.value)}
          placeholder={t("shortReview.placeholder")}
          ref={commentTextareaRef}
          value={draftComment}
        />

        <div className="mt-3 flex items-center justify-between">
          <button
            aria-expanded={isMoreOpen}
            className="inline-flex h-8 items-center gap-1 text-sm font-semibold text-[#75777d] transition hover:text-[var(--foreground)] active:scale-95"
            onClick={() => setIsMoreOpen((value) => !value)}
            type="button"
          >
            <span
              aria-hidden="true"
              className={`text-base leading-none transition-transform ${
                isMoreOpen ? "rotate-90" : ""
              }`}
            >
              ›
            </span>
            {t("shortReview.moreOptions")}
            {hasMoreChanges ? (
              <span aria-label={t("shortReview.changed")} className="ml-0.5">
                *
              </span>
            ) : null}
          </button>
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-[#c5c6cd] bg-white px-3 py-1.5 text-xs font-semibold text-[#333e50] shadow-sm transition hover:bg-[#f3f3f6] active:scale-95"
            onClick={() => {
              const textarea = commentTextareaRef.current;

              if (!textarea) {
                return;
              }

              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const selection = draftComment.slice(start, end);
              const spoiler = `>!${selection || t("shortReview.spoilerDefault")}!<`;
              const nextDraft =
                draftComment.slice(0, start) +
                spoiler +
                draftComment.slice(end);

              onDraftCommentChange(nextDraft);

              requestAnimationFrame(() => {
                textarea.focus();
                const nextCursor = start + spoiler.length;
                textarea.setSelectionRange(nextCursor, nextCursor);
              });
            }}
            type="button"
          >
            <span aria-hidden="true">🙈</span>
            {t("shortReview.spoilerButton")}
          </button>
        </div>

        {isMoreOpen ? (
          <section className="mt-4">
            <div>
              <h4 className="text-sm font-bold text-[var(--foreground)]">
                {t("shortReview.myTags")}
              </h4>
              <div className="short-review-tag-scroll -mx-1 mt-1 overflow-x-auto px-1 pb-2 pt-1">
                <div className="flex w-max gap-3">
                  {draftTags.map((tag) => (
                    <button
                      aria-label={t("shortReview.removeTag").replace("{tag}", tag)}
                      className="relative inline-flex h-[30px] max-w-[70vw] shrink-0 items-center rounded-full border border-[#b2ccc1]/60 bg-[#cee8dd]/35 px-3 text-xs font-semibold leading-4 text-[var(--foreground)] transition hover:bg-[#cee8dd]/60 active:scale-95"
                      key={tag}
                      onClick={() =>
                        onDraftTagsChange(draftTags.filter((value) => value !== tag))
                      }
                      type="button"
                    >
                      <span className="min-w-0 truncate">{tag}</span>
                      <span
                        aria-hidden="true"
                        className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full border border-[#b2ccc1]/70 bg-white text-[10px] font-bold leading-none text-[var(--foreground)] shadow-sm shadow-slate-900/10"
                      >
                        ×
                      </span>
                    </button>
                  ))}
                  <button
                    className="short-review-add-tag-button inline-flex h-[30px] max-w-[70vw] shrink-0 items-center rounded-full border bg-transparent px-3 text-xs font-semibold leading-4 transition active:scale-95"
                    onClick={() => setIsTagDialogOpen(true)}
                    type="button"
                  >
                    {t("shortReview.addTag")}
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3">
              <span className="text-sm font-bold text-[var(--foreground)]">
                {t("shortReview.visibilityMoreLabel")}
              </span>
              <Dropdown
                onChange={(value) =>
                  onDraftVisibilityChange(normalizeNeodbVisibility(value))
                }
                onOpenChange={setIsVisibilityOpen}
                open={isVisibilityOpen}
                options={[
                  { id: "0", label: t("shortReview.visibility.public") },
                  { id: "1", label: t("shortReview.visibility.followers") },
                  { id: "2", label: t("shortReview.visibility.private") },
                ]}
                overlayClassName="!z-[85]"
                value={String(draftVisibility)}
              />
            </div>
            <div
              className={`mt-3 flex items-center justify-between gap-3 ${
                canPostToFediverse ? "" : "opacity-55"
              }`}
            >
              <span className="text-sm font-bold text-[var(--foreground)]">
                {t("shortReview.postToFediverse")}
              </span>
              <PublishSwitch
                checked={canPostToFediverse && draftPostToFediverse}
                disabled={!canPostToFediverse}
                label={t("shortReview.postToFediverse")}
                onChange={onDraftPostToFediverseChange}
              />
            </div>
          </section>
        ) : null}

        <button
          className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c1c7cf]"
          disabled={status === "saving" || !hasSubmittableChanges}
          onClick={onSubmit}
          type="button"
        >
          {status === "saving" ? t("shortReview.saving") : t("shortReview.save")}
        </button>
      </div>

      {isDiscardOpen ? (
        <ConfirmDialog
          cancelLabel={t("shortReview.discard.cancelLabel")}
          confirmLabel={t("shortReview.discard.confirmLabel")}
          description={t("shortReview.discard.description")}
          onCancel={onDiscardCancel}
          onConfirm={onConfirmDiscard}
          title={t("shortReview.discard.title")}
          zIndex="z-[90]"
        />
      ) : null}

      {isTagDialogOpen ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm">
          <section className="review-editor-enter w-full max-w-md rounded-[2rem] border border-white/60 bg-white/85 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
            <header className="flex items-center justify-between gap-3 pb-2">
              <div className="flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
                  {t("detail.hashtags.addTitle")}
                </h3>
                <Dropdown
                  buttonClassName="max-w-40 border-white/60 bg-white/55 text-[#333e50] hover:bg-white/85"
                  disabled={tagLoadStatus === "loading"}
                  menuClassName="z-[101] max-h-64 max-w-[72vw] overflow-y-auto"
                  onChange={setSelectedTagId}
                  options={tagOptions}
                  overlayClassName="!z-[100]"
                  value={selectedTagId}
                />
              </div>
              <button
                aria-label={t("detail.hashtags.close")}
                className="grid size-10 shrink-0 place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
                onClick={() => setIsTagDialogOpen(false)}
                type="button"
              >
                <CloseIcon />
              </button>
            </header>
            <div className="mt-4 space-y-3">
              {isCreatingTag ? (
                <label className="block">
                  <span className="sr-only">{t("detail.hashtags.inputLabel")}</span>
                  <input
                    className="h-12 w-full rounded-[1.5rem] border border-white/60 bg-white/45 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
                    onChange={(event) => setTagInput(event.target.value)}
                    placeholder={t("detail.hashtags.placeholder")}
                    ref={tagInputRef}
                    value={tagInput}
                  />
                  <span className="mt-2 block px-1 text-xs font-semibold leading-5 text-[#75777d]">
                    {t("detail.hashtags.multiInputHint")}
                  </span>
                </label>
              ) : null}
              {tagLoadStatus === "error" ? (
                <p className="text-sm font-semibold text-[#b42318]">
                  {t("detail.hashtags.tagsLoadError")}
                </p>
              ) : null}
              <button
                className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c1c7cf]"
                disabled={tagLoadStatus === "loading"}
                onClick={addDraftTag}
                type="button"
              >
                {t("detail.hashtags.save")}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

type MyTag = {
  title: string;
  uuid: string;
};

function normalizeTagInput(value: string) {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, " ");
}

function parseTagInput(value: string) {
  return value
    .split(",")
    .map((tag) => normalizeTagInput(tag))
    .filter(Boolean);
}

function hasTag(tags: string[], tag: string) {
  const key = tag.toLocaleLowerCase();

  return tags.some((value) => value.trim().toLocaleLowerCase() === key);
}

function areSameTags(left: string[], right: string[]) {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((tag, index) => tag === right[index]);
}

function getRatingFromPointer(
  event: React.MouseEvent<HTMLButtonElement>,
  starIndex: number,
) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const isLeftHalf = event.clientX - bounds.left <= bounds.width / 2;

  return starIndex * 2 + (isLeftHalf ? 1 : 2);
}

function getRatingFromRatingRow(event: React.PointerEvent<HTMLDivElement>) {
  const bounds = event.currentTarget.getBoundingClientRect();
  const ratio = Math.min(
    1,
    Math.max(0, (event.clientX - bounds.left) / bounds.width),
  );

  // Unlike a direct tap on a star (getRatingFromPointer, floored at 1 = half
  // a star), dragging across the row can reach 0 — that's how you clear a
  // rating you've already set without leaving the dialog.
  return Math.min(10, Math.ceil(ratio * 10));
}

function getStarFill(rating: number, starIndex: number): 0 | 0.5 | 1 {
  const value = rating / 2 - starIndex;

  if (value >= 1) {
    return 1;
  }

  if (value >= 0.5) {
    return 0.5;
  }

  return 0;
}

function RatingStar({ fill }: { fill: 0 | 0.5 | 1 }) {
  return (
    <span className="relative grid size-5 place-items-center">
      <StarShape className="absolute inset-0 size-5" fill="none" />
      {fill > 0 ? (
        <span
          className="absolute inset-0 overflow-hidden"
          style={{ width: fill === 1 ? "100%" : "50%" }}
        >
          <StarShape className="size-5" fill="currentColor" />
        </span>
      ) : null}
    </span>
  );
}

function StarShape({
  className,
  fill,
}: {
  className: string;
  fill: "none" | "currentColor";
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={fill}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.3 1.1 6.1-5.6-2.9L6.4 20l1.1-6.1L3 9.6l6.2-.9Z" />
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

function useVisualKeyboardOpen() {
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;

    if (!viewport) {
      return;
    }

    const visualViewport = viewport;

    function syncKeyboardState() {
      const heightDelta =
        window.innerHeight - visualViewport.height - visualViewport.offsetTop;
      setIsKeyboardOpen(heightDelta > 120);
    }

    syncKeyboardState();
    visualViewport.addEventListener("resize", syncKeyboardState);
    visualViewport.addEventListener("scroll", syncKeyboardState);
    window.addEventListener("orientationchange", syncKeyboardState);

    return () => {
      visualViewport.removeEventListener("resize", syncKeyboardState);
      visualViewport.removeEventListener("scroll", syncKeyboardState);
      window.removeEventListener("orientationchange", syncKeyboardState);
    };
  }, []);

  return isKeyboardOpen;
}
