"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { pushNavigationFrame } from "@/components/navigation-history";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import type { HomeItem } from "@/lib/neodb";

type ProfileCollectionsGridProps = {
  items: HomeItem[];
};

export function ProfileCollectionsGrid({
  items: initialItems,
}: ProfileCollectionsGridProps) {
  const [items, setItems] = useState(initialItems);

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item, index) => (
        <CollectionCard
          index={index}
          item={item}
          key={item.id}
          onDelete={() =>
            setItems((current) =>
              current.filter((collection) => collection.id !== item.id),
            )
          }
          onRename={(title) =>
            setItems((current) =>
              current.map((collection) =>
                collection.id === item.id ? { ...collection, title } : collection,
              ),
            )
          }
        />
      ))}
    </div>
  );
}

function CollectionCard({
  index,
  item,
  onDelete,
  onRename,
}: {
  index: number;
  item: HomeItem;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [renameTitle, setRenameTitle] = useState(item.title);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function renameCollection() {
    const nextTitle = renameTitle.trim();

    if (!nextTitle || status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        `/api/neodb/collections/${encodeURIComponent(item.id)}`,
        {
          body: JSON.stringify({ title: nextTitle }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myCollections.renameError"));
      }

      await clearCollectionCache(item.id);
      onRename(nextTitle);
      setIsRenameOpen(false);
      showToast(t("profile.myCollections.renamed"));
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("profile.myCollections.renameError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  async function deleteCollection() {
    if (status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(
        `/api/neodb/collections/${encodeURIComponent(item.id)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myCollections.deleteError"));
      }

      await clearCollectionCache(item.id);
      onDelete();
      setIsDeleteOpen(false);
      showToast(t("profile.myCollections.deleted"));
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("profile.myCollections.deleteError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <article className="group relative overflow-hidden rounded-xl border border-white/80 bg-white shadow-md shadow-slate-900/8 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-slate-900/10 active:scale-[0.98]">
      <Link
        className="block"
        href={item.detailPath}
        onClick={() => pushNavigationFrame("detail", item.detailPath)}
      >
        <div className="relative aspect-[3/4] bg-[#f8f8fa]">
          {item.coverUrl ? (
            <Image
              alt={item.title}
              className="h-full w-full object-cover transition duration-700 ease-out group-hover:scale-105"
              decoding="async"
              fill
              loading={index < 9 ? "eager" : "lazy"}
              quality={75}
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 320px"
              src={item.coverUrl}
              unoptimized={process.env.NODE_ENV !== "production"}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-6 text-center text-sm font-semibold text-[#75777d]">
              {item.title}
            </div>
          )}
        </div>
      </Link>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/25 to-transparent p-2 pt-16">
        <div className="pointer-events-auto flex translate-y-2 items-center gap-2 rounded-2xl border border-white/30 bg-white/20 p-2.5 text-white opacity-95 backdrop-blur-md transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
          <Link
            className="min-w-0 flex-1"
            href={item.detailPath}
            onClick={() => pushNavigationFrame("detail", item.detailPath)}
          >
            <p className="line-clamp-2 text-sm font-bold leading-snug drop-shadow">
              {item.title}
            </p>
          </Link>
          <ActionMenu
            buttonClassName="size-9 shrink-0 text-white hover:bg-white/20"
            items={[
              {
                icon: <RenameIcon />,
                label: t("profile.myCollections.rename"),
                onClick: () => {
                  setRenameTitle(item.title);
                  setIsRenameOpen(true);
                },
              },
              {
                icon: <DeleteIcon />,
                label: t("profile.myCollections.delete"),
                onClick: () => setIsDeleteOpen(true),
                tone: "danger",
              },
            ]}
            label={t("profile.myCollections.menu")}
            placement="top"
          />
        </div>
      </div>

      {isRenameOpen ? (
        <ConfirmDialog
          cancelLabel={t("confirmDialog.defaultCancel")}
          confirmLabel={
            status === "saving"
              ? t("profile.myCollections.saving")
              : t("profile.myCollections.rename")
          }
          description={
            <input
              className="h-12 w-full rounded-2xl border border-white/60 bg-white/55 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
              onChange={(event) => setRenameTitle(event.target.value)}
              value={renameTitle}
            />
          }
          onCancel={() => setIsRenameOpen(false)}
          onConfirm={renameCollection}
          title={t("profile.myCollections.renameTitle")}
          zIndex="z-[110]"
        />
      ) : null}

      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={
            status === "saving"
              ? t("profile.myCollections.saving")
              : t("profile.myCollections.delete")
          }
          description={t("profile.myCollections.deleteDesc").replace(
            "{title}",
            item.title,
          )}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteCollection}
          title={t("profile.myCollections.deleteTitle")}
          zIndex="z-[110]"
        />
      ) : null}
    </article>
  );
}

async function clearCollectionCache(uuid: string) {
  await fetch(`/api/collection-cache?uuid=${encodeURIComponent(uuid)}`, {
    method: "POST",
  }).catch(() => undefined);
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
