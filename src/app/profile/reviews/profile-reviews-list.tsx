"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ReviewReaderTrigger } from "@/components/review-reader-trigger";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import { dispatchReviewStateChange } from "@/lib/review-state";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export type ProfileReviewItem = {
  body: string;
  createdAt: string;
  detailPath: string;
  itemCategory: string;
  itemTitle: string;
  itemUuid: string;
  preview: string;
  reviewTitle: string;
};

export function ProfileReviewsList({ items }: { items: ProfileReviewItem[] }) {
  const [reviewItems, setReviewItems] = useState(items);

  if (!reviewItems.length) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {reviewItems.map((item) => (
        <ProfileReviewCard
          item={item}
          key={`${item.itemUuid}-${item.reviewTitle}`}
          onDelete={() =>
            setReviewItems((current) =>
              current.filter((entry) => entry.itemUuid !== item.itemUuid),
            )
          }
        />
      ))}
    </div>
  );
}

function ProfileReviewCard({
  item,
  onDelete,
}: {
  item: ProfileReviewItem;
  onDelete: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const editHref = `/item/${encodeURIComponent(item.itemCategory)}/${encodeURIComponent(item.itemUuid)}/review`;

  async function deleteReview() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch(
        `/api/neodb/review?itemUuid=${encodeURIComponent(item.itemUuid)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myReviews.deleteError"));
      }

      setIsDeleteOpen(false);
      onDelete();
      dispatchReviewStateChange(item.itemUuid, false);
      showToast(t("profile.myReviews.deleted"));
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : t("profile.myReviews.deleteError"),
        "error",
      );
    } finally {
      setIsDeleting(false);
    }
  }

  function preserveReviewReturn() {
    window.sessionStorage.setItem(
      `${STORAGE_PREFIX}v1:detail-editor-return:${item.itemUuid}`,
      "/profile/reviews",
    );
  }

  function openItem() {
    router.push(item.detailPath);
  }

  function editReview() {
    preserveReviewReturn();
    router.push(editHref);
  }

  return (
    <article className="surface-glow relative rounded-2xl border border-white/70 bg-white/55 px-5 pb-1.5 pt-5 shadow-lg shadow-slate-900/5">
      <div className="surface-glow-floating absolute right-3 top-3">
        <ActionMenu
          buttonClassName="size-8 text-[#75777d] hover:text-[#333e50]"
          items={[
            {
              icon: <ItemIcon />,
              label: t("profile.myReviews.openItem"),
              onClick: openItem,
            },
            {
              icon: <EditIcon />,
              label: t("profile.myReviews.edit"),
              onClick: editReview,
            },
            {
              icon: <TrashIcon />,
              label: t("profile.myReviews.delete"),
              onClick: () => setIsDeleteOpen(true),
              tone: "danger",
            },
          ]}
          label={t("profile.myReviews.actions")}
          placement="bottom"
        />
      </div>
      <ReviewReaderTrigger
        body={item.body}
        className="block w-full cursor-pointer pr-9 text-left"
        itemUuid={item.itemUuid}
        title={item.reviewTitle}
      >
        <h2 className="truncate text-lg font-bold leading-7 text-[var(--foreground)]">
          {item.reviewTitle}
        </h2>
      </ReviewReaderTrigger>
      <ReviewReaderTrigger
        body={item.body}
        className="mt-3 block w-full cursor-pointer text-left"
        itemUuid={item.itemUuid}
        title={item.reviewTitle}
      >
        <p className="line-clamp-3 whitespace-pre-line text-sm leading-6 text-[#44474c]">
          {item.preview}
        </p>
      </ReviewReaderTrigger>
      <div className="mt-1.5 flex h-7 items-center justify-between gap-3 pt-1">
        <span className="min-w-0 truncate text-[11px] font-semibold leading-none text-[#75777d]">
          {t("profile.myReviews.reviewOfPrefix")}
          {t("profile.myReviews.reviewOfOpenQuote")}
          {item.itemTitle}
          {t("profile.myReviews.reviewOfSuffix")}
          {t("profile.myReviews.reviewOfPostfix")}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] font-semibold leading-none text-[#75777d]">
          {item.createdAt}
        </span>
      </div>
      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={
            isDeleting ? t("profile.myReviews.deleting") : t("profile.myReviews.delete")
          }
          description={t("profile.myReviews.deleteDesc").replace(
            "{title}",
            item.reviewTitle,
          )}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteReview}
          title={t("profile.myReviews.deleteTitle")}
        />
      ) : null}
    </article>
  );
}

function ItemIcon() {
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
      <path d="M4 19.5V5a2 2 0 0 1 2-2h12v18H6a2 2 0 0 1-2-1.5Z" />
      <path d="M8 7h6" />
      <path d="M8 11h8" />
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
