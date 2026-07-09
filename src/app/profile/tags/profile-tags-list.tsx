"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";

type ProfileTagItem = {
  count: number | null;
  title: string;
  uuid: string;
  visibility: number;
};

type ProfileTagsListProps = {
  countLabel: string;
  items: ProfileTagItem[];
};

export function ProfileTagsList({
  countLabel,
  items: initialItems,
}: ProfileTagsListProps) {
  const [items, setItems] = useState(initialItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3">
      {items.map((tag) => (
        <TagRow
          countLabel={countLabel}
          key={tag.uuid}
          onDelete={() =>
            setItems((current) =>
              current.filter((item) => item.uuid !== tag.uuid),
            )
          }
          onRename={(title) =>
            setItems((current) =>
              current.map((item) =>
                item.uuid === tag.uuid ? { ...item, title } : item,
              ),
            )
          }
          tag={tag}
        />
      ))}
    </div>
  );
}

function TagRow({
  countLabel,
  onDelete,
  onRename,
  tag,
}: {
  countLabel: string;
  onDelete: () => void;
  onRename: (title: string) => void;
  tag: ProfileTagItem;
}) {
  const router = useRouter();
  const t = useT();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(tag.title);
  const [status, setStatus] = useState<"idle" | "saving">("idle");
  const href = `/profile/tags/${encodeURIComponent(tag.uuid)}?title=${encodeURIComponent(tag.title)}`;

  async function renameTag() {
    const nextTitle = renameTitle.trim();

    if (!nextTitle || status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(getTagApiPath(tag.uuid), {
        body: JSON.stringify({ title: nextTitle, visibility: tag.visibility }),
        headers: { "Content-Type": "application/json" },
        method: "PUT",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myTags.renameError"));
      }

      onRename(nextTitle);
      setIsRenameOpen(false);
      showToast(t("profile.myTags.renamed"));
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("profile.myTags.renameError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  async function deleteTag() {
    if (status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(getTagApiPath(tag.uuid), {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myTags.deleteError"));
      }

      onDelete();
      setIsDeleteOpen(false);
      showToast(t("profile.myTags.deleted"));
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("profile.myTags.deleteError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <article className="group relative min-w-0 rounded-2xl border border-white/60 bg-white/55 shadow-lg shadow-slate-900/5 backdrop-blur-2xl transition hover:bg-white/75 active:scale-[0.98]">
      <Link
        className="flex min-w-0 items-center justify-between gap-4 px-5 py-4 pr-14"
        href={href}
      >
        <div className="flex min-w-0 items-center gap-4">
          <span className="grid size-10 shrink-0 place-items-center text-[var(--foreground)]">
            <TagIcon />
          </span>
          <span className="min-w-0 break-words text-lg font-bold text-[var(--foreground)] [overflow-wrap:anywhere]">
            {tag.title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2 text-[#75777d]">
          {typeof tag.count === "number" ? (
            <span className="text-xs font-bold">
              {countLabel.replace("{count}", String(tag.count))}
            </span>
          ) : null}
          <ChevronRightIcon />
        </div>
      </Link>

      <div className="absolute right-2 top-1/2 z-10 -translate-y-1/2">
        <ActionMenu
          buttonClassName="size-9 text-[#44474c] hover:bg-white/55"
          items={[
            {
              icon: <RenameIcon />,
              label: t("profile.myTags.rename"),
              onClick: () => {
                setRenameTitle(tag.title);
                setIsRenameOpen(true);
              },
            },
            {
              icon: <DeleteIcon />,
              label: t("profile.myTags.delete"),
              onClick: () => setIsDeleteOpen(true),
              tone: "danger",
            },
          ]}
          label={t("profile.myTags.menu")}
        />
      </div>

      {isRenameOpen ? (
        <ConfirmDialog
          cancelLabel={t("confirmDialog.defaultCancel")}
          confirmLabel={
            status === "saving"
              ? t("profile.myTags.saving")
              : t("profile.myTags.rename")
          }
          description={
            <input
              className="h-12 w-full rounded-2xl border border-white/60 bg-white/55 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
              onChange={(event) => setRenameTitle(event.target.value)}
              value={renameTitle}
            />
          }
          onCancel={() => setIsRenameOpen(false)}
          onConfirm={renameTag}
          title={t("profile.myTags.renameTitle")}
          zIndex="z-[110]"
        />
      ) : null}

      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={
            status === "saving"
              ? t("profile.myTags.saving")
              : t("profile.myTags.delete")
          }
          description={t("profile.myTags.deleteDesc").replace(
            "{title}",
            tag.title,
          )}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteTag}
          title={t("profile.myTags.deleteTitle")}
          zIndex="z-[110]"
        />
      ) : null}
    </article>
  );
}

function getTagApiPath(uuid: string) {
  return `/api/neodb/tags/${encodeURIComponent(uuid)}`;
}

function TagIcon() {
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
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function RenameIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function DeleteIcon() {
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
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5M14 11v5" />
    </svg>
  );
}
