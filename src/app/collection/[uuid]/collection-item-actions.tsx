"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";

type CollectionItemActionsProps = {
  itemTitle: string;
  itemUuid: string;
  uuid: string;
};

export function CollectionItemActions({
  itemTitle,
  itemUuid,
  uuid,
}: CollectionItemActionsProps) {
  const router = useRouter();
  const t = useT();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function deleteItem() {
    if (status === "saving") {
      return;
    }

    setStatus("saving");

    try {
      const response = await fetch(getItemApiPath(uuid, itemUuid), {
        method: "DELETE",
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("collection.itemDeleteError"));
      }

      await clearCollectionCache(uuid);
      showToast(t("collection.itemDeleted"));
      setIsDeleteOpen(false);
      router.refresh();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : t("collection.itemDeleteError"),
        "error",
      );
    } finally {
      setStatus("idle");
    }
  }

  return (
    <>
      <div className="absolute right-2 top-2 z-10">
        <button
          aria-label={t("collection.deleteItem")}
          className="grid size-9 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/45 active:scale-95"
          onClick={() => setIsDeleteOpen(true)}
          type="button"
        >
          <DeleteIcon />
        </button>
      </div>

      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={
            status === "saving"
              ? t("collection.deleting")
              : t("collection.deleteItem")
          }
          description={t("collection.deleteItemDesc").replace(
            "{title}",
            itemTitle,
          )}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteItem}
          title={t("collection.deleteItemTitle")}
          zIndex="z-[110]"
        />
      ) : null}
    </>
  );
}

function getItemApiPath(uuid: string, itemUuid: string) {
  return `/api/neodb/collections/${encodeURIComponent(uuid)}/items/${encodeURIComponent(itemUuid)}`;
}

async function clearCollectionCache(uuid: string) {
  await fetch(`/api/collection-cache?uuid=${encodeURIComponent(uuid)}`, {
    method: "POST",
  }).catch(() => undefined);
}

function DeleteIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-[18px] shrink-0"
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
