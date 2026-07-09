"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { PaginationPill } from "@/components/pagination-pill";
import { ReviewReaderTrigger } from "@/components/review-reader-trigger";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import {
  performNavigationClose,
  resolveDetailCloseAction,
} from "@/components/navigation-history";
import { DETAIL_EDITOR_RETURN_PREFIX } from "./detail-state";

type NoteItem = {
  content: string;
  createdAt: string;
  progressType?: NoteProgressType | null;
  progressValue?: string | null;
  title: string;
  url: string | null;
  uuid: string;
  visibility: number;
};

type NoteProgressType =
  | "chapter"
  | "cycle"
  | "episode"
  | "page"
  | "part"
  | "percentage"
  | "timestamp"
  | "track";

type NotesPayload = {
  count?: number;
  error?: string;
  notes?: NoteItem[];
  page?: number;
  pages?: number;
};

export function MyNotesDialog({
  category,
  itemTitle,
  itemUuid,
  onClose,
}: {
  category: string;
  itemTitle: string;
  itemUuid: string;
  onClose: () => void;
}) {
  const t = useT();
  const dialogTitle = t("detail.notes.titleWithItem").replace(
    "{title}",
    itemTitle,
  );
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  function closeDialog() {
    setIsClosing(true);
    window.setTimeout(onClose, 160);
  }

  if (typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[110] overflow-y-auto bg-[var(--background)] text-[var(--foreground)] ${
        isClosing ? "review-reader-exit" : "review-reader-enter"
      }`}
    >
      <header className="sticky top-0 z-10 w-screen border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3">
          <button
            aria-label={t("detail.notes.close")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={closeDialog}
            type="button"
          >
            <CloseIcon />
          </button>
          <ScrollingTopBarTitle title={dialogTitle} />
        </div>
      </header>

      <NotesContent category={category} itemUuid={itemUuid} />
    </div>,
    document.body,
  );
}

export function MyNotesPage({
  category,
  itemTitle,
  itemUuid,
}: {
  category: string;
  itemTitle: string;
  itemUuid: string;
}) {
  const t = useT();
  const router = useRouter();
  const title = t("detail.notes.titleWithItem").replace("{title}", itemTitle);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3">
          <button
            aria-label={t("detail.notes.close")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={() =>
              performNavigationClose(resolveDetailCloseAction(), router)
            }
            type="button"
          >
            <CloseIcon />
          </button>
          <ScrollingTopBarTitle title={title} />
        </div>
      </header>
      <div aria-hidden="true" className="h-16" />
      <NotesContent category={category} itemUuid={itemUuid} />
    </>
  );
}

function NotesContent({
  category,
  itemUuid,
}: {
  category: string;
  itemUuid: string;
}) {
  const t = useT();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();

    async function loadNotes() {
      setStatus("loading");

      try {
        const response = await fetch(
          `/api/neodb/note?itemUuid=${encodeURIComponent(itemUuid)}&page=${page}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const payload = (await response.json().catch(() => null)) as
          | NotesPayload
          | null;

        if (!response.ok) {
          throw new Error(payload?.error || t("detail.notes.loadError"));
        }

        setNotes(Array.isArray(payload?.notes) ? payload.notes : []);
        setPageCount(Math.max(1, payload?.pages || 1));
        setStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        setStatus("error");
        showToast(
          error instanceof Error ? error.message : t("detail.notes.loadError"),
          "error",
        );
      }
    }

    loadNotes();

    return () => controller.abort();
  }, [itemUuid, page, t]);

  return (
    <main className="px-5 pb-32 pt-8">
      <section className="mx-auto max-w-2xl lg:max-w-4xl">
        {status === "loading" ? (
          <>
            <NotesSkeleton />
            <NotesPagination
              currentPage={page}
              disabled
              onPageChange={setPage}
              pages={pageCount}
            />
          </>
        ) : null}

        {status === "error" ? (
          <EmptyState text={t("detail.notes.loadError")} />
        ) : null}

        {status === "ready" && notes.length === 0 ? (
          <EmptyState text={t("detail.notes.empty")} />
        ) : null}

        {status === "ready" && notes.length > 0 ? (
          <>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {notes.map((note) => (
                <NoteCard
                  category={category}
                  itemUuid={itemUuid}
                  key={note.uuid}
                  note={note}
                  onDelete={() =>
                    setNotes((current) =>
                      current.filter((entry) => entry.uuid !== note.uuid),
                    )
                  }
                />
              ))}
            </div>
            <NotesPagination
              currentPage={page}
              onPageChange={setPage}
              pages={pageCount}
            />
          </>
        ) : null}
      </section>
    </main>
  );
}

function NotesPagination({
  currentPage,
  disabled = false,
  onPageChange,
  pages,
}: {
  currentPage: number;
  disabled?: boolean;
  onPageChange: (page: number) => void;
  pages: number;
}) {
  if (pages <= 1) {
    return null;
  }

  return (
    <div className="mt-8 flex justify-center">
      <PaginationPill
        activePage={currentPage}
        onPageChange={(nextPage) => {
          if (disabled) {
            return;
          }

          onPageChange(nextPage);
          window.scrollTo({ top: 0 });
        }}
        pages={pages}
      />
    </div>
  );
}

function ScrollingTopBarTitle({ title }: { title: string }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const frame = frameRef.current;
    const titleNode = titleRef.current;

    if (!frame || !titleNode) {
      return;
    }

    const frameNode = frame;
    const measuredTitleNode = titleNode;

    function updateOverflow() {
      setIsOverflowing(measuredTitleNode.scrollWidth > frameNode.clientWidth);
    }

    updateOverflow();

    const observer = new ResizeObserver(updateOverflow);
    observer.observe(frameNode);
    observer.observe(measuredTitleNode);

    return () => {
      observer.disconnect();
    };
  }, [title]);

  return (
    <div
      className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-left text-base font-bold text-[var(--foreground)]"
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
  );
}

function NoteCard({
  category,
  itemUuid,
  note,
  onDelete,
}: {
  category: string;
  itemUuid: string;
  note: NoteItem;
  onDelete: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const preview = useMemo(() => createPreview(note.content), [note.content]);
  const createdAt = useMemo(() => formatDateTime(note.createdAt), [note.createdAt]);
  const displayTitle = getNoteDisplayTitle(note, t);

  function editNote() {
    const params = new URLSearchParams({ noteUuid: note.uuid });

    try {
      window.sessionStorage.setItem(
        `${DETAIL_EDITOR_RETURN_PREFIX}${itemUuid}`,
        `/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/notes`,
      );
    } catch {
      // The editor can still fall back to the detail page.
    }

    router.push(
      `/item/${encodeURIComponent(category)}/${encodeURIComponent(itemUuid)}/note?${params.toString()}`,
    );
  }

  async function deleteNote() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/neodb/note?noteUuid=${encodeURIComponent(note.uuid)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("detail.notes.deleteError"));
      }

      setIsDeleteOpen(false);
      onDelete();
      showToast(t("detail.notes.deleted"));
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("detail.notes.deleteError"),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <article className="surface-glow relative flex h-full flex-col rounded-2xl border border-white/70 bg-white/55 px-5 pb-1.5 pt-5 shadow-lg shadow-slate-900/5">
      <div className="surface-glow-floating absolute right-3 top-3">
        <ActionMenu
          buttonClassName="size-8 text-[#75777d] hover:text-[#333e50]"
          items={[
            {
              icon: <EditIcon />,
              label: t("detail.notes.edit"),
              onClick: editNote,
            },
            {
              icon: <TrashIcon />,
              label: t("detail.notes.delete"),
              onClick: () => setIsDeleteOpen(true),
              tone: "danger" as const,
            },
          ]}
          label={t("detail.notes.actions")}
          placement="bottom"
        />
      </div>
      <ReviewReaderTrigger
        body={note.content}
        className="block w-full cursor-pointer pr-9 text-left"
        itemUuid={itemUuid}
        showShare={false}
        title={displayTitle}
      >
        <h2 className="truncate text-lg font-bold leading-7 text-[var(--foreground)]">
          {displayTitle}
        </h2>
      </ReviewReaderTrigger>
      <ReviewReaderTrigger
        body={note.content}
        className="mt-3 block w-full cursor-pointer text-left"
        itemUuid={itemUuid}
        showShare={false}
        title={displayTitle}
      >
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#44474c]">
          {preview || t("detail.notes.emptyBody")}
        </p>
      </ReviewReaderTrigger>
      <div className="mt-auto flex h-7 items-center justify-start pt-1">
        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold leading-none text-[#75777d]">
          {createdAt}
        </span>
      </div>
      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={
            isDeleting ? t("detail.notes.deleting") : t("detail.notes.delete")
          }
          description={t("detail.notes.deleteDesc").replace(
            "{title}",
            displayTitle,
          )}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteNote}
          title={t("detail.notes.deleteTitle")}
        />
      ) : null}
    </article>
  );
}

function NotesSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {Array.from({ length: 4 }).map((_, index) => (
        <div
          aria-hidden="true"
          className="surface-glow flex h-full flex-col rounded-2xl border border-white/70 bg-white/55 px-5 pb-1.5 pt-5 shadow-lg shadow-slate-900/5"
          key={index}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#dfe0e4]" />
            <div className="size-7 animate-pulse rounded-full bg-[#dfe0e4]" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-4 animate-pulse rounded-full bg-[#dfe0e4]" />
            <div className="h-4 animate-pulse rounded-full bg-[#dfe0e4]" />
            <div className="h-4 w-4/5 animate-pulse rounded-full bg-[#dfe0e4]" />
          </div>
          <div className="mt-auto flex h-7 justify-start pt-1">
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#dfe0e4]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
      {text}
    </div>
  );
}

function createPreview(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~|-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function getNoteDisplayTitle(
  note: NoteItem,
  t: (key: string) => string,
) {
  if (note.progressType && note.progressValue) {
    return t(`noteEditor.progressTitle.${note.progressType}`).replace(
      "{value}",
      note.progressValue,
    );
  }

  return note.title || t("detail.notes.fallbackTitle");
}

function formatDateTime(value?: string) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
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

function EditIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TrashIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
