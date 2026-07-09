"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/use-t";

export function CommunityTime({
  createdAt,
  fallback = "",
  className = "text-xs font-semibold text-[#75777d]",
}: {
  createdAt?: string;
  fallback?: string;
  className?: string;
}) {
  const displayTime = useCommunityTime(createdAt, fallback);

  if (!displayTime) {
    return null;
  }

  return <p className={className}>{displayTime}</p>;
}

function useCommunityTime(createdAt: string | undefined, fallback: string) {
  const t = useT();
  const [displayTime, setDisplayTime] = useState(fallback);

  useEffect(() => {
    window.queueMicrotask(() => {
      setDisplayTime(formatCommunityTime(createdAt, fallback, t));
    });
  }, [createdAt, fallback, t]);

  return displayTime;
}

function formatCommunityTime(
  createdAt: string | undefined,
  fallback: string,
  t: (key: string) => string,
) {
  if (!createdAt) {
    return fallback;
  }

  const date = new Date(createdAt);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff >= 0 && diff < 2 * 60 * 60 * 1000) {
    return t("community.justNow");
  }

  const time = formatClock(date);

  if (isSameLocalDate(date, now)) {
    return formatTemplate(t("community.todayTime"), { time });
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);

  if (isSameLocalDate(date, yesterday)) {
    return formatTemplate(t("community.yesterdayTime"), { time });
  }

  const values = {
    day: String(date.getDate()),
    month: String(date.getMonth() + 1),
    time,
    year: String(date.getFullYear()),
  };

  if (date.getFullYear() === now.getFullYear()) {
    return formatTemplate(t("community.thisYearTime"), values);
  }

  return formatTemplate(t("community.fullDateTime"), values);
}

function isSameLocalDate(first: Date, second: Date) {
  return (
    first.getFullYear() === second.getFullYear() &&
    first.getMonth() === second.getMonth() &&
    first.getDate() === second.getDate()
  );
}

function formatClock(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, value),
    template,
  );
}
