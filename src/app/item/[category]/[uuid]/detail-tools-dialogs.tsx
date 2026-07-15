"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/components/use-t";
import { CloseIcon, useLockedBodyScroll } from "@/components/related-links-dialog";
import type { HomeItem } from "@/lib/neodb";

export function TrackListDialog({
  onClose,
  title,
  tracks,
}: {
  onClose: () => void;
  title: string;
  tracks: string[];
}) {
  const t = useT();

  useLockedBodyScroll();

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <section
        className="review-editor-enter flex max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md flex-col overflow-hidden rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between gap-3 pb-2">
          <div className="min-w-0">
            <h2 className="text-xl font-bold text-[var(--foreground)]">
              {t("detail.tools.trackList")}
            </h2>
            <p className="mt-1 truncate text-sm font-semibold text-[#75777d]">
              {title}
            </p>
          </div>
          <button
            aria-label={t("detail.tools.closeTrackList")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <ol className="mt-3 max-h-[min(24rem,calc(100dvh_-_13rem_-_env(safe-area-inset-bottom)))] overflow-y-auto overscroll-contain rounded-2xl border border-white/60 bg-white/45">
          {tracks.map((track, index) => (
            <li
              className="grid grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-3 border-b-2 border-[#c5c6cd]/30 px-4 py-3 last:border-0"
              key={`${track}-${index}`}
            >
              <span className="pt-0.5 text-right text-xs font-bold tabular-nums text-[#75777d]">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="min-w-0 break-words text-sm font-semibold leading-6 text-[var(--foreground)]">
                {track}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </div>,
    document.body,
  );
}

export function AddToCollectionDialog({
  itemUuid,
  onClose,
}: {
  itemUuid: string;
  onClose: () => void;
}) {
  const t = useT();
  const [collections, setCollections] = useState<HomeItem[]>([]);
  const [collectionTitle, setCollectionTitle] = useState("");
  const [selectedCollectionId, setSelectedCollectionId] = useState("__new__");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [isSaving, setIsSaving] = useState(false);
  const collectionOptions = [
    {
      id: "__new__",
      label: t("detail.tools.createCollection"),
    },
    ...collections.map((collection) => ({
      id: collection.id,
      label: collection.title,
    })),
  ];
  const isCreatingCollection = selectedCollectionId === "__new__";

  useLockedBodyScroll();

  useEffect(() => {
    let cancelled = false;

    fetch("/api/neodb/collections")
      .then(async (response) => {
        if (!response.ok) {
          const payload = (await response.json().catch(() => null)) as
            | { error?: string }
            | null;
          throw new Error(payload?.error || t("detail.tools.collectionLoadError"));
        }

        return (await response.json()) as { items?: HomeItem[] };
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }

        setCollections(Array.isArray(payload.items) ? payload.items : []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) {
          setStatus("error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  async function addToCollection() {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const response = await fetch("/api/neodb/collection-add", {
        body: JSON.stringify({
          collectionTitle:
            collectionTitle.trim() || t("detail.tools.defaultCollectionTitle"),
          collectionUuid: selectedCollectionId,
          itemUuid,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("detail.tools.collectionAddError"));
      }

      showToast(t("detail.tools.collectionAdded"));
      onClose();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("detail.tools.collectionAddError"),
        "error",
      );
      setIsSaving(false);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm">
      <section className="review-editor-enter max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
        <header className="flex items-center justify-between gap-3 pb-2">
          <div className="flex min-w-0 items-center gap-2">
            <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
              {t("detail.tools.addToCollection")}
            </h2>
            <Dropdown
              buttonClassName="max-w-40 border-white/60 bg-white/55 text-[#333e50] hover:bg-white/85"
              disabled={status === "loading"}
              menuClassName="z-[101] max-h-64 max-w-[72vw] overflow-y-auto"
              onChange={setSelectedCollectionId}
              options={collectionOptions}
              overlayClassName="!z-[100]"
              value={selectedCollectionId}
            />
          </div>
          <button
            aria-label={t("detail.tools.closeCollectionDialog")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="space-y-3">
          {isCreatingCollection ? (
            <input
              className="h-12 w-full rounded-[1.5rem] border border-white/60 bg-white/45 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
              onChange={(event) => setCollectionTitle(event.target.value)}
              placeholder={t("detail.tools.defaultCollectionTitle")}
              type="text"
              value={collectionTitle}
            />
          ) : null}
        </div>

        <button
          className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c1c7cf]"
          disabled={status === "loading" || isSaving}
          onClick={addToCollection}
          type="button"
        >
          {isSaving ? t("detail.tools.collectionSaving") : t("detail.tools.collectionSave")}
        </button>
      </section>
    </div>,
    document.body,
  );
}
