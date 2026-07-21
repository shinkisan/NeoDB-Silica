"use client";

import { useT } from "./use-t";

export type ShelfType = "wishlist" | "progress" | "complete" | "dropped";

export function StatusBadge({
  category,
  progressRatio,
  status,
}: {
  category: string;
  progressRatio?: number | null;
  status: string;
}) {
  const t = useT();
  const progressPercentage =
    status === "progress" && progressRatio !== null && progressRatio !== undefined
      ? Math.round(Math.min(1, Math.max(0, progressRatio)) * 100)
      : null;
  const tone =
    progressPercentage !== null
      ? "border-[#ead9a7]/80 text-[#6d5522]"
      : getStatusTone(status);

  return (
    <span
      className={`status-badge status-badge-${status} badge-text-trim rounded-full border px-3 py-[7.2px] text-xs font-bold ${progressPercentage !== null ? "relative overflow-hidden" : ""} ${tone}`}
      data-reading-progress-percentage={progressPercentage ?? undefined}
    >
      {progressPercentage !== null ? (
        <span
          aria-hidden="true"
          className="absolute inset-y-0 left-0 bg-[#f7ebc6]/70"
          data-reading-progress-fill
          style={{ width: `${progressPercentage}%` }}
        />
      ) : null}
      {progressPercentage !== null ? (
        <span className="relative">
          {t(getStatusKey(category, status))}
          {t("mark.readingProgress.badgePercentage").replace(
            "{value}",
            String(progressPercentage),
          )}
        </span>
      ) : (
        t(getStatusKey(category, status))
      )}
    </span>
  );
}

export function RatingBadge({ value }: { value: number | null }) {
  const t = useT();

  if (!value) {
    return (
      <span
        aria-label={t("mark.noRating")}
        className="flex items-center gap-1 rounded-full border border-[#bcc7dd]/80 bg-[#dde3eb]/70 px-2.5 py-[7.2px]"
      >
        <span className="badge-text-trim text-xs font-bold text-[#333e50]">{t("mark.noRating")}</span>
      </span>
    );
  }

  const ratingUnits = Math.max(0, Math.min(5, value / 2));
  const activeStars = Math.floor(ratingUnits);
  const hasHalfStar = ratingUnits % 1 >= 0.5;

  return (
    <span
      aria-label={t("mark.ratingAria").replace("{value}", String(value))}
      className="flex items-center gap-1 rounded-full border border-[#bcc7dd]/80 bg-[#dde3eb]/70 px-2.5 py-[7.2px]"
    >
      {Array.from({ length: activeStars }, (_, index) => (
        <span
          className="rating-badge-dot size-1.5 rounded-full bg-[#333e50]"
          key={index}
        />
      ))}
      {hasHalfStar ? (
        <span className="rating-badge-half-dot relative size-1.5 overflow-hidden rounded-full border border-[#333e50]">
          <span className="rating-badge-dot absolute inset-y-0 left-0 w-1/2 bg-[#333e50]" />
        </span>
      ) : null}
      <span className="badge-text-trim ml-1 text-xs font-bold text-[#333e50]">
        {value.toFixed(1)}
      </span>
    </span>
  );
}

export function getStatusLabel(category: string, status: string) {
  const readMap: Record<string, string> = {
    wishlist: "想读",
    progress: "在读",
    complete: "读过",
    dropped: "搁置",
  };
  const watchMap: Record<string, string> = {
    wishlist: "想看",
    progress: "在看",
    complete: "看过",
    dropped: "搁置",
  };
  const listenMap: Record<string, string> = {
    wishlist: "想听",
    progress: "在听",
    complete: "听过",
    dropped: "搁置",
  };
  const playMap: Record<string, string> = {
    wishlist: "想玩",
    progress: "在玩",
    complete: "玩过",
    dropped: "搁置",
  };

  if (category === "movie" || category === "tv") {
    return watchMap[status] || status;
  }

  if (category === "music" || category === "podcast") {
    return listenMap[status] || status;
  }

  if (category === "game") {
    return playMap[status] || status;
  }

  return readMap[status] || status;
}

export function getStatusKey(category: string, status: string): string {
  if (category === "movie" || category === "tv") {
    return `mark.status.watch.${status}`;
  }

  if (category === "music" || category === "podcast") {
    return `mark.status.listen.${status}`;
  }

  if (category === "game") {
    return `mark.status.play.${status}`;
  }

  return `mark.status.read.${status}`;
}

export function getStatusTone(status: string) {
  if (status === "dropped") {
    return "border-[#d9d9de]/80 bg-[#ececef]/75 text-[#75777d]";
  }

  if (status === "progress") {
    return "border-[#ead9a7]/80 bg-[#f7ebc6]/70 text-[#6d5522]";
  }

  if (status === "wishlist") {
    return "border-[#efcad2]/80 bg-[#f8dfe5]/70 text-[#7a4651]";
  }

  return "border-[#b2ccc1]/70 bg-[#cee8dd]/55 text-[#344b43]";
}
