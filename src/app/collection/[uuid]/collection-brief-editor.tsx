"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";

type CollectionBriefEditorProps = {
  canEdit: boolean;
  description: string;
  uuid: string;
};

export function CollectionBriefEditor({
  canEdit,
  description,
  uuid,
}: CollectionBriefEditorProps) {
  const router = useRouter();
  const t = useT();
  const [draft, setDraft] = useState(description);
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  useEffect(() => {
    setDraft(description);
  }, [description]);

  async function saveBrief() {
    if (status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        `/api/neodb/collections/${encodeURIComponent(uuid)}`,
        {
          body: JSON.stringify({ brief: draft }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("collection.briefUpdateError"));
      }

      await fetch(`/api/collection-cache?uuid=${encodeURIComponent(uuid)}`, {
        method: "POST",
      }).catch(() => undefined);
      showToast(t("collection.briefUpdated"));
      setIsOpen(false);
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("collection.briefUpdateError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <>
      {description || canEdit ? (
        <p className="max-w-full whitespace-pre-line break-words text-base leading-7 text-[#44474c] [overflow-wrap:anywhere]">
          {description || t("collection.noBrief")}
          {canEdit ? (
            <button
              aria-label={t("collection.editBrief")}
              className="ml-1.5 inline-grid size-5 place-items-center rounded-full border border-white/70 bg-white/60 align-[-0.18em] text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
              onClick={() => {
                setDraft(description);
                setIsOpen(true);
              }}
              type="button"
            >
              <PencilIcon />
            </button>
          ) : null}
        </p>
      ) : null}

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <BriefDialog
              draft={draft}
              onChange={setDraft}
              onClose={() => setIsOpen(false)}
              onSave={saveBrief}
              status={status}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function BriefDialog({
  draft,
  onChange,
  onClose,
  onSave,
  status,
}: {
  draft: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  status: "idle" | "saving";
}) {
  const t = useT();

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

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm">
      <section className="review-editor-enter max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
        <header className="flex items-center justify-between gap-4 pb-2">
          <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
            {t("collection.editBrief")}
          </h2>
          <button
            aria-label={t("collection.closeBriefEditor")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <textarea
          className="min-h-40 w-full resize-none rounded-[1.5rem] border border-white/60 bg-white/45 p-4 text-base leading-7 text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("collection.briefPlaceholder")}
          value={draft}
        />

        <button
          className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-wait disabled:bg-[#c1c7cf]"
          disabled={status === "saving"}
          onClick={onSave}
          type="button"
        >
          {status === "saving" ? t("collection.saving") : t("collection.saveBrief")}
        </button>
      </section>
    </div>
  );
}

function PencilIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
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
