"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { ProfileLink } from "@/components/profile-link";
import { SpoilerText } from "@/components/spoiler-text";
import { useT } from "@/components/use-t";
import { CommunityTime } from "@/app/item/[category]/[uuid]/community-time";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { writeLastSeenNotificationId } from "@/lib/notification-read-state";
import { pushNavigationFrame } from "@/components/navigation-history";
import { renderTextWithEmoji } from "@/lib/mastodon-emoji";
import { formatAccountHandle } from "@/lib/account-handle";
import type {
  NotificationsResponse,
  TimelineNotification,
} from "./notification-types";
import type { TimelineStatus } from "../timeline-types";

type NotificationState = "loading" | "ready" | "guest" | "error";

export function NotificationsPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnHref = getNotificationReturnHref(searchParams.get("from"));
  const [items, setItems] = useState<TimelineNotification[]>([]);
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [state, setState] = useState<NotificationState>("loading");
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/neodb/notifications");

        if (response.status === 401) {
          if (!cancelled) setState("guest");
          return;
        }

        if (!response.ok) throw new Error("notifications fetch failed");

        const payload = (await response.json()) as NotificationsResponse;

        if (!cancelled) {
          setItems(payload.notifications);
          setNextMaxId(payload.nextMaxId);
          setHasMore(payload.hasMore);
          writeLastSeenNotificationId(payload.notifications[0]?.id || "");
          setState("ready");
        }
      } catch {
        if (!cancelled) setState("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function loadMore() {
    if (!nextMaxId || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({ maxId: nextMaxId });
      const response = await fetch(`/api/neodb/notifications?${params.toString()}`);
      if (!response.ok) throw new Error("notifications fetch failed");

      const payload = (await response.json()) as NotificationsResponse;
      setItems((current) => mergeNotifications(current, payload.notifications));
      setNextMaxId(payload.nextMaxId);
      setHasMore(payload.hasMore);
    } catch {
      showToast(t("notifications.loadError"), "error");
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl lg:pl-32 lg:pr-8">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
          <button
            aria-label={t("notifications.close")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={() => router.push(returnHref)}
            type="button"
          >
            <CloseIcon />
          </button>
          <h1 className="min-w-0 truncate text-base font-bold text-[var(--foreground)]">
            {t("notifications.title")}
          </h1>
        </div>
      </header>
      <main className="min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)] lg:pl-32 lg:pr-8">
        <section className="mx-auto w-full max-w-2xl">
          {state === "loading" ? <NotificationsInlineSkeleton /> : null}
          {state === "guest" ? (
            <NotificationsEmpty text={t("notifications.loginRequired")} />
          ) : null}
          {state === "error" ? (
            <NotificationsEmpty text={t("notifications.loadError")} />
          ) : null}
          {state === "ready" && !items.length ? (
            <NotificationsEmpty text={t("notifications.empty")} />
          ) : null}
          {state === "ready" && items.length ? (
            <>
              <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-slate-900/5">
                {items.map((notification) => (
                  <NotificationCard
                    key={notification.id}
                    notification={notification}
                  />
                ))}
              </div>
              {hasMore ? (
                <div className="mt-5 flex justify-center">
                  <button
                    className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={isLoadingMore}
                    onClick={loadMore}
                    type="button"
                  >
                    {isLoadingMore
                      ? t("notifications.loading")
                      : t("notifications.loadMore")}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

function getNotificationReturnHref(value: string | null) {
  if (!value) {
    return "/timeline";
  }

  try {
    const url = new URL(value, "https://app.local");

    if (url.origin === "https://app.local" && url.pathname === "/timeline") {
      return `${url.pathname}${url.search}`;
    }
  } catch {
    return "/timeline";
  }

  return "/timeline";
}

function NotificationCard({
  notification,
}: {
  notification: TimelineNotification;
}) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const status = notification.status;
  const content = status?.content || "";
  const accountHandle = formatAccountHandle(notification.account.acct);

  return (
    <article className="flex min-w-0 gap-3 border-b border-[#c5c6cd]/30 p-4 last:border-0 sm:p-5">
      <ProfileLink
        accountId={notification.account.id}
        className="shrink-0 rounded-full transition active:scale-95"
        isRemote={notification.account.isRemote}
        url={notification.account.url}
      >
        {notification.account.avatar && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-11 rounded-full border-2 border-white bg-[#dde3eb] object-cover"
            loading="lazy"
            onError={() => setAvatarFailed(true)}
            src={notification.account.avatar}
          />
        ) : (
          <div className="grid size-11 place-items-center rounded-full border-2 border-white bg-[#dde3eb] text-sm font-bold text-[#333e50]">
            {notification.account.displayName.slice(0, 1)}
          </div>
        )}
      </ProfileLink>
      <div className="min-w-0 flex-1">
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 gap-y-1">
            <ProfileLink
              accountId={notification.account.id}
              className="max-w-full truncate text-sm font-bold text-[var(--foreground)] transition hover:underline"
              isRemote={notification.account.isRemote}
              url={notification.account.url}
            >
              {renderTextWithEmoji(
                notification.account.displayName,
                notification.account.emojis,
              )}
            </ProfileLink>
            <span className="text-sm font-semibold text-[#75777d]">
              {t(`notifications.types.${notification.type}`)}
            </span>
          </div>
          {accountHandle ? (
            <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-[#75777d]">
              {accountHandle}
            </div>
          ) : null}
        </div>
        <CommunityTime
          className="mt-1 text-xs font-semibold text-[#75777d]"
          createdAt={notification.createdAt}
        />
        {content ? (
          <p className="mt-3 line-clamp-4 whitespace-pre-line break-words text-[15px] leading-6 text-[#44474c] [overflow-wrap:anywhere]">
            <SpoilerText
              emojis={status?.contentEmojis}
              mentions={status?.contentMentions}
              text={content}
            />
          </p>
        ) : null}
        {status?.item ? <NotificationItem item={status.item} /> : null}
        {status?.review ? (
          <p className="mt-3 rounded-xl border border-white/60 bg-white/45 p-3 text-sm font-bold text-[var(--foreground)]">
            {status.review.title}
          </p>
        ) : null}
      </div>
    </article>
  );
}

function NotificationItem({ item }: { item: NonNullable<TimelineStatus["item"]> }) {
  const t = useT();
  const category = getActivityItemCategory(item.href);
  const content = (
    <>
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-[4.5rem] w-[3.25rem] shrink-0 rounded-lg bg-[#dde3eb] object-cover shadow-sm"
          loading="lazy"
          src={item.cover}
        />
      ) : (
        <div className="grid h-[4.5rem] w-[3.25rem] shrink-0 place-items-center rounded-lg bg-[#dde3eb] text-[#75777d]">
          <BookIcon />
        </div>
      )}
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-bold leading-5 text-[var(--foreground)]">
          {item.title}
        </div>
        <div className="mt-1 text-xs font-semibold text-[#75777d]">
          {category ? t(`category.${category}`) : item.type}
        </div>
      </div>
      <ChevronIcon />
    </>
  );
  const className =
    "mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-white/60 bg-white/45 p-2.5 shadow-sm transition hover:bg-white/70";

  return item.href.startsWith("/") ? (
    <Link
      className={className}
      href={item.href}
      onClick={() => {
        requestDetailScrollTopForHref(item.href);
        pushNavigationFrame("detail", item.href);
      }}
    >
      {content}
    </Link>
  ) : (
    <a className={className} href={item.href} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}

function NotificationsInlineSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-slate-900/5">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          className="flex gap-3 border-b border-[#c5c6cd]/30 p-4 last:border-0 sm:p-5"
          key={index}
        >
          <div className="size-11 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="h-4 w-3/5 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-14 animate-pulse rounded-xl bg-[#e2e2e5]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function NotificationsEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/70 px-5 py-12 text-center text-sm font-semibold text-[#75777d] shadow-lg shadow-slate-900/5">
      {text}
    </div>
  );
}

function mergeNotifications(
  current: TimelineNotification[],
  incoming: TimelineNotification[],
) {
  const seen = new Set(current.map((item) => item.id));
  return [
    ...current,
    ...incoming.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    }),
  ];
}

function getActivityItemCategory(href: string | undefined) {
  if (!href) return null;
  const match = /^\/item\/([^/]+)/.exec(href);
  return match?.[1] || null;
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
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      viewBox="0 0 24 24"
    >
      <path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" />
      <path d="M7 16h12M8 8h7" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ml-auto size-4 shrink-0 text-[#75777d]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
