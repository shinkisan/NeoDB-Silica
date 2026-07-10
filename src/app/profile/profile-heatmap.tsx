"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

type NeodbUser = {
  avatar: string;
  display_name: string;
  external_accounts?: Array<{ acct?: string; url?: string }>;
  external_acct?: string | null;
  roles: string[];
  url: string;
  username: string;
};

type CalendarResponse = Record<string, { items: string[] }>;
type CalendarCachePayload = {
  cachedAt: number;
  value: CalendarResponse;
};
type HeatmapCell = {
  category: string | null;
  date: string;
  level: number;
};

const PROFILE_CACHE_KEY = `${STORAGE_PREFIX}v1:profile:user`;
const CALENDAR_CACHE_PREFIX = `${STORAGE_PREFIX}v1:profile:calendar:`;
const CALENDAR_CACHE_TTL = 6 * 60 * 60 * 1000;

export function ProfileHeatmapBackdrop({
  hasSession,
  initialUser,
}: {
  hasSession: boolean;
  initialUser: NeodbUser | null;
}) {
  const [handle, setHandle] = useState(initialUser?.username || "");

  useEffect(() => {
    if (!hasSession) {
      return;
    }

    fetch("/api/neodb/me")
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as NeodbUser;
      })
      .then((nextUser) => {
        if (nextUser?.username) {
          setHandle(nextUser.username);
          writeProfileCache(nextUser);
        }
      })
      .catch(() => {
        // The empty heatmap still works as a soft page background.
      });
  }, [hasSession]);

  if (!hasSession) {
    return null;
  }

  return (
    <div className="profile-heatmap-backdrop pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden">
      {handle ? <ProfileHeatmap handle={handle} /> : <ProfileHeatmapPattern />}
      <div className="profile-heatmap-darken absolute inset-0" />
      <div className="profile-heatmap-fade absolute inset-0" />
    </div>
  );
}

export function UserHeatmapBackdrop({ handle }: { handle: string }) {
  return (
    <div className="profile-heatmap-backdrop pointer-events-none absolute inset-x-0 top-0 h-[34rem] overflow-hidden">
      <ProfileHeatmap handle={handle} />
      <div className="profile-heatmap-darken absolute inset-0" />
      <div className="profile-heatmap-fade absolute inset-0" />
    </div>
  );
}

function writeProfileCache(user: NeodbUser) {
  window.localStorage.setItem(
    PROFILE_CACHE_KEY,
    JSON.stringify({
      savedAt: Date.now(),
      user,
    }),
  );
}

function ProfileHeatmap({ handle }: { handle: string }) {
  const [calendar, setCalendar] = useState<CalendarResponse | null>(null);
  const cells = useMemo(() => buildHeatmapCells(calendar), [calendar]);

  useEffect(() => {
    let cancelled = false;
    const cacheKey = `${CALENDAR_CACHE_PREFIX}${handle}`;

    window.queueMicrotask(() => {
      if (cancelled) {
        return;
      }

      const cachedCalendar = readCalendarCache(cacheKey);

      if (cachedCalendar) {
        setCalendar(cachedCalendar);
      }
    });

    fetch(`/api/neodb/calendar?handle=${encodeURIComponent(handle)}`)
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }

        return (await response.json()) as CalendarResponse;
      })
      .then((nextCalendar) => {
        if (cancelled || !nextCalendar) {
          return;
        }

        setCalendar(nextCalendar);
        writeCalendarCache(cacheKey, nextCalendar);
      })
      .catch(() => {
        // The cached or empty heatmap is still a valid decorative background.
      });

    return () => {
      cancelled = true;
    };
  }, [handle]);

  return (
    <div className="absolute inset-0 overflow-hidden">
      <ProfileHeatmapPattern cells={cells} />
    </div>
  );
}

function ProfileHeatmapPattern({
  cells = buildHeatmapCells(null),
}: {
  cells?: HeatmapCell[];
}) {
  return (
    <>
      <div className="profile-heatmap-glow absolute inset-0" />
      <div className="absolute left-1/2 top-24 grid -translate-x-1/2 grid-flow-col grid-rows-7 gap-2 opacity-70 [grid-auto-columns:14px] sm:top-22 sm:gap-2.5 sm:[grid-auto-columns:16px]">
        {cells.map((cell) => (
          <span
            aria-hidden="true"
            className="size-3.5 rounded sm:size-4"
            key={cell.date}
            style={getHeatmapCellStyle(cell)}
          />
        ))}
      </div>
    </>
  );
}

function buildHeatmapCells(calendar: CalendarResponse | null) {
  const today = startOfDay(new Date());
  const currentMonday = startOfMondayWeek(today);
  const start = addDays(currentMonday, -84);

  const cells: HeatmapCell[] = [];
  let cursor = start;

  for (let i = 0; i < 91; i++) {
    const date = formatDate(cursor);

    if (cursor > today) {
      cells.push({ category: null, date, level: 0 });
    } else {
      const items = calendar?.[date]?.items || [];
      cells.push({
        category: getDominantCategory(items),
        date,
        level: getHeatmapLevel(items.length),
      });
    }

    cursor = addDays(cursor, 1);
  }

  return cells;
}

function getHeatmapLevel(count: number) {
  if (count === 0) {
    return 0;
  }

  if (count === 1) {
    return 1;
  }

  if (count === 2) {
    return 2;
  }

  if (count <= 4) {
    return 3;
  }

  return 4;
}

function getDominantCategory(items: string[]) {
  if (!items.length) {
    return null;
  }

  const counts = new Map<string, number>();
  let dominantCategory = items[0];
  let dominantCount = 0;

  for (const item of items) {
    const nextCount = (counts.get(item) || 0) + 1;
    counts.set(item, nextCount);

    if (nextCount > dominantCount) {
      dominantCategory = item;
      dominantCount = nextCount;
    }
  }

  return dominantCategory;
}

function getHeatmapCellStyle(cell: HeatmapCell): CSSProperties {
  if (cell.level === 0 || !cell.category) {
    return { background: "rgba(202, 215, 208, 0.65)" };
  }

  const palette = getCategoryPalette(cell.category);
  const glowOpacity = [0, 0.14, 0.2, 0.28, 0.36][cell.level] || 0.14;
  const glowSize = [0, 10, 14, 20, 28][cell.level] || 10;
  const gradient = palette.steps[cell.level - 1];

  return {
    background: `linear-gradient(145deg, ${gradient[0]}, ${gradient[1]})`,
    boxShadow: `0 0 ${glowSize}px ${palette.glow.replace("<alpha>", String(glowOpacity))}`,
  };
}

function getCategoryPalette(category: string) {
  const palettes: Record<string, { glow: string; steps: Array<[string, string]> }> = {
    book: {
      glow: "rgba(180, 210, 165, <alpha>)",
      steps: [
        ["#d3e5ca", "#c4dbb8"],
        ["#c4dbb8", "#b4d2a5"],
        ["#b4d2a5", "#a4c793"],
        ["#9bc286", "#82ae6d"],
      ],
    },
    game: {
      glow: "rgba(197, 162, 144, <alpha>)",
      steps: [
        ["#dbc4b8", "#d0b3a4"],
        ["#d0b3a4", "#c5a290"],
        ["#c5a290", "#b9917c"],
        ["#ae826b", "#966b55"],
      ],
    },
    movie: {
      glow: "rgba(124, 189, 254, <alpha>)",
      steps: [
        ["#b5d9fe", "#9dccfe"],
        ["#9dccfe", "#7cbdfe"],
        ["#7cbdfe", "#64adf6"],
        ["#4a9bef", "#3287d9"],
      ],
    },
    music: {
      glow: "rgba(254, 163, 109, <alpha>)",
      steps: [
        ["#ffc9a8", "#ffb98e"],
        ["#ffb98e", "#fea36d"],
        ["#fea36d", "#f58d50"],
        ["#e77a38", "#c96126"],
      ],
    },
    other: {
      glow: "rgba(254, 211, 124, <alpha>)",
      steps: [
        ["#ffe2a8", "#fedb92"],
        ["#fedb92", "#fed37c"],
        ["#fed37c", "#efbd60"],
        ["#dda94b", "#bd8933"],
      ],
    },
    performance: {
      glow: "rgba(254, 124, 124, <alpha>)",
      steps: [
        ["#ffb4b4", "#fe9a9a"],
        ["#fe9a9a", "#fe7c7c"],
        ["#fe7c7c", "#ef6565"],
        ["#dc5050", "#bc3939"],
      ],
    },
    podcast: {
      glow: "rgba(157, 106, 176, <alpha>)",
      steps: [
        ["#c9aed3", "#b891c7"],
        ["#b891c7", "#9d6ab0"],
        ["#9d6ab0", "#89589b"],
        ["#754987", "#5d356e"],
      ],
    },
    tv: {
      glow: "rgba(253, 219, 35, <alpha>)",
      steps: [
        ["#ffea78", "#ffe252"],
        ["#ffe252", "#fddb23"],
        ["#fddb23", "#edc914"],
        ["#d6b400", "#b59600"],
      ],
    },
  };

  return palettes[category] || palettes.other;
}

function readCalendarCache(key: string): CalendarResponse | null {
  const rawCache = window.localStorage.getItem(key);

  if (!rawCache) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawCache) as Partial<CalendarCachePayload>;

    if (
      typeof parsed.cachedAt === "number" &&
      parsed.value &&
      Date.now() - parsed.cachedAt <= CALENDAR_CACHE_TTL
    ) {
      return parsed.value;
    }

    window.localStorage.removeItem(key);
    return null;
  } catch {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeCalendarCache(key: string, calendar: CalendarResponse) {
  window.localStorage.setItem(
    key,
    JSON.stringify({
      cachedAt: Date.now(),
      value: calendar,
    }),
  );
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const nextDate = new Date(date);
  nextDate.setHours(0, 0, 0, 0);
  return nextDate;
}

function startOfMondayWeek(date: Date) {
  const nextDate = startOfDay(date);
  const daysSinceMonday = (nextDate.getDay() + 6) % 7;
  nextDate.setDate(nextDate.getDate() - daysSinceMonday);
  return nextDate;
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}
