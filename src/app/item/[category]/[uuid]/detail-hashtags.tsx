"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/components/use-t";
import { SearchMetaLink } from "./search-meta-link";

type DetailHashtag = {
  label: string;
  tag: string;
};

type DetailHashtagsProps = {
  tags: DetailHashtag[];
};

type MarkSnapshot = {
  commentText?: string;
  itemUuid: string;
  ratingGrade?: number;
  tags?: string[];
  visibility?: number;
};

type MyTag = {
  title: string;
  uuid: string;
};

export function DetailHashtags({ tags }: DetailHashtagsProps) {
  const [currentTags, setCurrentTags] = useState(tags);
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const tagsRef = useRef<HTMLElement>(null);
  const t = useT();

  useEffect(() => {
    setCurrentTags(tags);
  }, [tags]);

  useEffect(() => {
    const tagsElement = tagsRef.current;

    if (!tagsElement || isExpanded) {
      return;
    }

    function measure() {
      if (!tagsElement) {
        return;
      }

      setCanExpand(tagsElement.scrollHeight - tagsElement.clientHeight > 1);
    }

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(tagsElement);

    return () => resizeObserver.disconnect();
  }, [isExpanded, tags]);

  return (
    <div className="relative min-w-0 max-w-full pt-1">
      <nav
        aria-label="Hashtags"
        className={`flex min-w-0 max-w-full flex-wrap gap-x-3 gap-y-2 text-sm font-semibold ${
          !isExpanded ? "max-h-12 overflow-hidden" : ""
        }`}
        ref={tagsRef}
      >
        {currentTags.map(({ label, tag }) => {
          const params = new URLSearchParams({
            category: "all",
            q: `tag:${tag}`,
          });
          const href = `/search?${params.toString()}`;

          return (
            <SearchMetaLink
              className="detail-hashtag-link min-w-0 max-w-full break-words text-[var(--detail-hashtag-color)] underline decoration-[var(--detail-hashtag-decoration)] decoration-1 underline-offset-4 transition hover:text-[var(--detail-hashtag-hover)] hover:decoration-[var(--detail-hashtag-hover-decoration)] [overflow-wrap:anywhere]"
              href={href}
              key={tag}
            >
              #{label}
            </SearchMetaLink>
          );
        })}
        {canExpand && isExpanded ? (
          <button
            aria-expanded={isExpanded}
            className="detail-hashtag-link font-semibold text-[var(--detail-hashtag-color)] underline decoration-[var(--detail-hashtag-decoration)] decoration-1 underline-offset-4 transition hover:text-[var(--detail-hashtag-hover)] hover:decoration-[var(--detail-hashtag-hover-decoration)]"
            onClick={() => setIsExpanded(false)}
            type="button"
          >
            {t("detail.hashtags.collapse")}
          </button>
        ) : null}
      </nav>
      {canExpand && !isExpanded ? (
        <button
          aria-expanded={isExpanded}
          className="detail-hashtag-link absolute bottom-0 right-0 bg-[var(--background)] pl-2 text-sm font-semibold text-[var(--detail-hashtag-color)] underline decoration-[var(--detail-hashtag-decoration)] decoration-1 underline-offset-4 transition hover:text-[var(--detail-hashtag-hover)] hover:decoration-[var(--detail-hashtag-hover-decoration)]"
          onClick={() => setIsExpanded(true)}
          type="button"
        >
          {t("detail.hashtags.expand")}
        </button>
      ) : null}
    </div>
  );
}

export function AddTagDialog({
  currentTags = [],
  itemUuid,
  onAdd,
  onClose,
}: {
  currentTags?: string[];
  itemUuid: string;
  onAdd?: (tag: string) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [myTags, setMyTags] = useState<MyTag[]>([]);
  const [selectedTagId, setSelectedTagId] = useState("__new__");
  const [tag, setTag] = useState("");
  const [loadStatus, setLoadStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const inputRef = useRef<HTMLInputElement>(null);
  const tagOptions = [
    { id: "__new__", label: t("detail.hashtags.createTag") },
    ...myTags.map((entry) => ({ id: entry.uuid, label: entry.title })),
  ];
  const isCreatingTag = selectedTagId === "__new__";

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";
    window.setTimeout(() => inputRef.current?.focus(), 80);

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
        setLoadStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setLoadStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function submitTag() {
    if (status === "saving") {
      return;
    }

    const selectedTag = myTags.find((entry) => entry.uuid === selectedTagId);
    const nextTag = isCreatingTag
      ? normalizeTagInput(tag)
      : normalizeTagInput(selectedTag?.title || "");

    if (!nextTag) {
      showToast(
        isCreatingTag
          ? t("detail.hashtags.empty")
          : t("detail.hashtags.selectTag"),
        "error",
      );
      return;
    }

    if (hasTag(currentTags, nextTag)) {
      showToast(t("detail.hashtags.duplicate"), "error");
      return;
    }

    setStatus("saving");

    try {
      const markResponse = await fetch(
        `/api/neodb/mark?itemUuid=${encodeURIComponent(itemUuid)}`,
        { cache: "no-store" },
      );
      const mark = (await markResponse.json().catch(() => null)) as
        | (MarkSnapshot & { error?: string })
        | null;

      if (!markResponse.ok) {
        throw new Error(mark?.error || t("detail.hashtags.loadError"));
      }

      const existingTags = Array.isArray(mark?.tags) ? mark.tags : [];

      if (hasTag(existingTags, nextTag)) {
        throw new Error(t("detail.hashtags.duplicate"));
      }

      const saveResponse = await fetch("/api/neodb/mark", {
        body: JSON.stringify({
          itemUuid,
          tags: [...existingTags, nextTag],
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const saved = (await saveResponse.json().catch(() => null)) as
        | (MarkSnapshot & { error?: string })
        | null;

      if (!saveResponse.ok) {
        throw new Error(saved?.error || t("detail.hashtags.saveError"));
      }

      onAdd?.(nextTag);
      showToast(t("detail.hashtags.saved"));
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("detail.hashtags.saveError"),
        "error",
      );
      setStatus("idle");
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm">
      <section className="review-editor-enter max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
        <header className="flex items-center justify-between gap-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
              {t("detail.hashtags.addTitle")}
            </h2>
            <Dropdown
              buttonClassName="max-w-40 border-white/60 bg-white/55 text-[#333e50] hover:bg-white/85"
              disabled={loadStatus === "loading"}
              menuClassName="z-[101] max-h-64 max-w-[72vw] overflow-y-auto"
              onChange={setSelectedTagId}
              options={tagOptions}
              overlayClassName="!z-[100]"
              value={selectedTagId}
            />
          </div>
          <button
            aria-label={t("detail.hashtags.close")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <form
          className="mt-4 space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            void submitTag();
          }}
        >
          {isCreatingTag ? (
            <label className="block">
              <span className="sr-only">{t("detail.hashtags.inputLabel")}</span>
              <input
                className="h-12 w-full rounded-[1.5rem] border border-white/60 bg-white/45 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
                onChange={(event) => setTag(event.target.value)}
                placeholder={t("detail.hashtags.placeholder")}
                ref={inputRef}
                value={tag}
              />
            </label>
          ) : null}

          {loadStatus === "error" ? (
            <p className="text-sm font-semibold text-[#b42318]">
              {t("detail.hashtags.tagsLoadError")}
            </p>
          ) : null}

          <button
            className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c1c7cf]"
            disabled={loadStatus === "loading" || status === "saving"}
            type="submit"
          >
            {status === "saving"
              ? t("detail.hashtags.saving")
              : t("detail.hashtags.save")}
          </button>
        </form>
      </section>
    </div>,
    document.body,
  );
}

function normalizeTagInput(value: string) {
  return value.trim().replace(/^#+/, "").replace(/\s+/g, " ");
}

function hasTag(tags: string[], tag: string) {
  const key = tag.toLocaleLowerCase();

  return tags.some((value) => value.trim().toLocaleLowerCase() === key);
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
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
