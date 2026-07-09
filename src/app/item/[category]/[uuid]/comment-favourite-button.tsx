"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";

type CommentFavouriteButtonProps = {
  count: number;
  disabled: boolean;
  favourited: boolean;
  postId: string;
  onChange?: (next: { count: number; favourited: boolean }) => void;
  hideZeroCount?: boolean;
};

export function CommentFavouriteButton({
  count,
  disabled,
  favourited,
  postId,
  onChange,
  hideZeroCount = false,
}: CommentFavouriteButtonProps) {
  const t = useT();
  const [currentCount, setCurrentCount] = useState(count);
  const [isFavourited, setIsFavourited] = useState(favourited);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => {
      setCurrentCount(count);
      setIsFavourited(favourited);
    });
  }, [count, favourited]);

  async function toggleFavourite() {
    if (isSaving) {
      return;
    }

    if (disabled) {
      showToast(t("favourite.loginToLike"), "error");
      return;
    }

    const nextFavourited = !isFavourited;
    const previousCount = currentCount;
    const previousFavourited = isFavourited;

    setIsSaving(true);
    setIsFavourited(nextFavourited);
    setCurrentCount(Math.max(0, currentCount + (nextFavourited ? 1 : -1)));
    onChange?.({
      count: Math.max(0, currentCount + (nextFavourited ? 1 : -1)),
      favourited: nextFavourited,
    });

    try {
      const response = await fetch("/api/neodb/post-favourite", {
        body: JSON.stringify({
          favourite: nextFavourited,
          postId,
        }),
        headers: {
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        favourited?: boolean;
        favouritesCount?: number | null;
      } | null;

      if (!response.ok) {
        throw new Error(payload?.error || "点赞失败。");
      }

      const resolvedFavourited = payload?.favourited ?? nextFavourited;
      const resolvedCount =
        typeof payload?.favouritesCount === "number"
          ? payload.favouritesCount
          : Math.max(0, currentCount + (nextFavourited ? 1 : -1));

      setIsFavourited(resolvedFavourited);
      setCurrentCount(resolvedCount);
      onChange?.({ count: resolvedCount, favourited: resolvedFavourited });

    } catch {
      setIsFavourited(previousFavourited);
      setCurrentCount(previousCount);
      onChange?.({ count: previousCount, favourited: previousFavourited });
      showToast(t("favourite.error"), "error");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <button
      aria-pressed={isFavourited}
      className={`flex items-center gap-1.5 text-xs font-semibold transition ${
        isFavourited ? "text-[#7a4651]" : "text-[#75777d] hover:text-[#333e50]"
      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
      disabled={isSaving}
      onClick={toggleFavourite}
      title={disabled ? t("favourite.loginToLike") : isFavourited ? t("favourite.unlike") : t("favourite.like")}
      type="button"
    >
      <HeartIcon filled={isFavourited} />
      {hideZeroCount && currentCount === 0 ? null : currentCount}
    </button>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M20.8 4.6a5.4 5.4 0 0 0-7.6 0L12 5.8l-1.2-1.2a5.4 5.4 0 1 0-7.6 7.6L12 21l8.8-8.8a5.4 5.4 0 0 0 0-7.6Z" />
    </svg>
  );
}
