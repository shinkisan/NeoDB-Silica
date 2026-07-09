"use client";

import { useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { useT } from "@/components/use-t";
import { invalidateTimelineCache } from "@/lib/timeline-cache";

export function BoostButton({
  count,
  disabled,
  onChange,
  postId,
  reblogged,
  variant = "inline",
}: {
  count: number;
  disabled?: boolean;
  onChange: (next: { count: number; reblogged: boolean }) => void;
  postId: string;
  reblogged: boolean;
  variant?: "icon" | "inline";
}) {
  const t = useT();
  const [currentCount, setCurrentCount] = useState(count);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isReblogged, setIsReblogged] = useState(reblogged);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => {
      setCurrentCount(count);
      setIsReblogged(reblogged);
    });
  }, [count, reblogged]);

  async function updateReblog(nextReblogged: boolean) {
    if (isSaving) return;

    const previous = { count: currentCount, reblogged: isReblogged };
    const optimisticCount = Math.max(
      0,
      currentCount + (nextReblogged ? 1 : -1),
    );

    setIsConfirmOpen(false);
    setIsSaving(true);
    setCurrentCount(optimisticCount);
    setIsReblogged(nextReblogged);
    onChange({ count: optimisticCount, reblogged: nextReblogged });

    try {
      const response = await fetch("/api/neodb/post-reblog", {
        body: JSON.stringify({ postId, reblog: nextReblogged }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        reblogged?: boolean;
        reblogsCount?: number | null;
      } | null;

      if (!response.ok) throw new Error("reblog failed");

      const resolved = {
        count:
          typeof payload?.reblogsCount === "number"
            ? payload.reblogsCount
            : optimisticCount,
        reblogged: payload?.reblogged ?? nextReblogged,
      };
      setCurrentCount(resolved.count);
      setIsReblogged(resolved.reblogged);
      onChange(resolved);
      // A reblog toggle adds or removes an entry in my own timeline, so mark
      // the cached "mine" (and following) timelines stale to force a refresh.
      invalidateTimelineCache();
      showToast(
        resolved.reblogged
          ? t("timeline.reblog.success")
          : t("timeline.reblog.cancelled"),
      );
    } catch {
      setCurrentCount(previous.count);
      setIsReblogged(previous.reblogged);
      onChange(previous);
      showToast(t("timeline.reblog.error"), "error");
    } finally {
      setIsSaving(false);
    }
  }

  const buttonClass =
    variant === "icon"
      ? `inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-full px-1.5 text-xs font-semibold transition hover:bg-white/70 hover:text-[var(--foreground)] active:scale-95 aria-disabled:opacity-45 ${
          isReblogged ? "text-[var(--theme-primary)]" : "text-[#75777d]"
        }`
      : `inline-flex min-w-6 items-center gap-1 text-xs font-semibold transition active:scale-95 aria-disabled:opacity-45 ${
          isReblogged
            ? "text-[var(--theme-primary)]"
            : "text-[#75777d] hover:text-[#333e50]"
        }`;

  return (
    <>
      <button
        aria-disabled={disabled}
        aria-label={
          isReblogged
            ? t("timeline.reblog.undo")
            : t("timeline.reblog.button")
        }
        aria-pressed={isReblogged}
        className={buttonClass}
        disabled={isSaving}
        onClick={() => {
          if (disabled) {
            showToast(t("timeline.reblog.loginRequired"));
            return;
          }
          if (isReblogged) {
            void updateReblog(false);
          } else {
            setIsConfirmOpen(true);
          }
        }}
        type="button"
      >
        <BoostIcon />
        {currentCount > 0 ? currentCount : null}
      </button>

      {isConfirmOpen ? (
        <ConfirmDialog
          confirmLabel={t("timeline.reblog.confirm")}
          description={t("timeline.reblog.description")}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => void updateReblog(true)}
          title={t("timeline.reblog.title")}
        />
      ) : null}
    </>
  );
}

function BoostIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="m17 3 4 4-4 4" />
      <path d="M3 11V9a2 2 0 0 1 2-2h16" />
      <path d="m7 21-4-4 4-4" />
      <path d="M21 13v2a2 2 0 0 1-2 2H3" />
    </svg>
  );
}
