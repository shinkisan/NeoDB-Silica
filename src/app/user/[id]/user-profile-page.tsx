"use client";

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";
import { BackToTopButton } from "@/components/back-to-top";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ActionMenu } from "@/components/action-menu";
import type { RelatedLink } from "@/components/related-links-dialog";
import { ActivityCardList, type UpdateActivityStatus } from "@/components/activity-card";
import { SpoilerText } from "@/components/spoiler-text";
import { UserHeatmapBackdrop } from "@/app/profile/profile-heatmap";
import { CloseDetailButton } from "@/app/item/[category]/[uuid]/close-detail-button";
import { TimelineListSkeleton } from "@/app/timeline/timeline-skeleton";
import type { TimelineResponse, TimelineStatus } from "@/app/timeline/timeline-types";
import { renderTextWithEmoji, type MastodonEmoji } from "@/lib/mastodon-emoji";
import { shareContent } from "@/lib/clipboard";
import { siteConfig } from "@/site.config";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const LazyRelatedLinksDialog = lazy(() =>
  import("@/components/related-links-dialog").then((module) => ({
    default: module.RelatedLinksDialog,
  })),
);

type ProfileLink = {
  hostname: string;
  href: string;
  kind: "neodb" | "mastodon" | "other" | string;
};

type AccountProfile = {
  acct: string;
  avatar: string;
  bio: string;
  blocking: boolean;
  displayName: string;
  emojis: MastodonEmoji[];
  followedBy: boolean;
  following: boolean;
  id: string;
  isSelf: boolean;
  links: ProfileLink[];
  requested: boolean;
  url: string;
  username: string;
};

type AccountState = "loading" | "ready" | "guest" | "error";
type ActivityState = "loading" | "ready" | "error";

const USER_PROFILE_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:user-profile:scroll:`;
const USER_PROFILE_RESTORE_PREFIX = `${STORAGE_PREFIX}v1:user-profile:restore:`;
const USER_PROFILE_CACHE_PREFIX = `${STORAGE_PREFIX}v12:user-profile-cache:`;
const USER_PROFILE_ACTIVITY_ID = "recent-activity";
const USER_PROFILE_ACTIVITY_TOP_OFFSET = 80;
const USER_PROFILE_ACTIVITY_VISIBILITY_EPSILON = 2;

type UserProfileCacheEntry = {
  account: AccountProfile;
  hasMore: boolean;
  nextMaxId: string | null;
  statuses: TimelineStatus[];
};

function readUserProfileCache(id: string): UserProfileCacheEntry | null {
  try {
    const raw = window.sessionStorage.getItem(`${USER_PROFILE_CACHE_PREFIX}${id}`);
    if (!raw) return null;

    const entry = JSON.parse(raw) as Partial<UserProfileCacheEntry>;
    return entry?.account && Array.isArray(entry.statuses)
      ? {
          account: entry.account,
          hasMore: Boolean(entry.hasMore),
          nextMaxId: entry.nextMaxId || null,
          statuses: entry.statuses,
        }
      : null;
  } catch {
    return null;
  }
}

function writeUserProfileCache(id: string, entry: UserProfileCacheEntry) {
  try {
    window.sessionStorage.setItem(
      `${USER_PROFILE_CACHE_PREFIX}${id}`,
      JSON.stringify(entry),
    );
  } catch {
    // The cache is a best-effort optimization; a write failure should not break the page.
  }
}

function clearUserProfileCache(id: string) {
  try {
    window.sessionStorage.removeItem(`${USER_PROFILE_CACHE_PREFIX}${id}`);
  } catch {
    // Nothing to clean up if storage is unavailable.
  }
}

export function UserProfilePage({ id }: { id: string }) {
  const t = useT();
  const [account, setAccount] = useState<AccountProfile | null>(null);
  const [accountState, setAccountState] = useState<AccountState>("loading");
  const [statuses, setStatuses] = useState<TimelineStatus[]>([]);
  const [activityState, setActivityState] = useState<ActivityState>("loading");
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasScrolledPastActivityStart, setHasScrolledPastActivityStart] =
    useState(false);

  useEffect(() => {
    let frame = 0;

    function evaluate() {
      frame = 0;
      const target = document.getElementById(USER_PROFILE_ACTIVITY_ID);
      if (!target) {
        setHasScrolledPastActivityStart(false);
        return;
      }

      const top = target.getBoundingClientRect().top;
      setHasScrolledPastActivityStart(
        top <
          USER_PROFILE_ACTIVITY_TOP_OFFSET -
            USER_PROFILE_ACTIVITY_VISIBILITY_EPSILON,
      );
    }

    function onScroll() {
      if (frame) return;
      frame = window.requestAnimationFrame(evaluate);
    }

    queueMicrotask(evaluate);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const cached = readUserProfileCache(id);

    if (cached) {
      setAccount(cached.account);
      setAccountState("ready");
      setStatuses(cached.statuses);
      setActivityState("ready");
      setNextMaxId(cached.nextMaxId);
      setHasMore(cached.hasMore);

      if (!cached.account.isSelf) {
        return () => {
          cancelled = true;
        };
      }
    }

    if (!cached) {
      setAccountState("loading");
      setAccount(null);
      setActivityState("loading");
      setStatuses([]);
      setNextMaxId(null);
      setHasMore(false);
    }

    async function load() {
      let nextAccount: AccountProfile;

      try {
        const accountResponse = await fetch(`/api/neodb/account?id=${encodeURIComponent(id)}`);

        if (accountResponse.status === 401) {
          if (!cancelled) setAccountState("guest");
          return;
        }

        if (!accountResponse.ok) {
          throw new Error("account fetch failed");
        }

        nextAccount = (await accountResponse.json()) as AccountProfile;
      } catch {
        if (!cancelled && !cached) setAccountState("error");
        return;
      }

      if (cancelled) return;
      setAccount(nextAccount);
      setAccountState("ready");

      try {
        const activityResponse = await fetch(
          `/api/neodb/timeline?accountId=${encodeURIComponent(id)}`,
        );

        if (!activityResponse.ok) {
          throw new Error("activity fetch failed");
        }

        const payload = (await activityResponse.json()) as TimelineResponse;

        if (cancelled) return;
        setStatuses(payload.statuses);
        setActivityState("ready");
        setNextMaxId(payload.nextMaxId);
        setHasMore(payload.hasMore);
        writeUserProfileCache(id, {
          account: nextAccount,
          hasMore: payload.hasMore,
          nextMaxId: payload.nextMaxId,
          statuses: payload.statuses,
        });
      } catch {
        if (!cancelled && !cached) setActivityState("error");
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [id]);

  async function loadMoreActivity() {
    if (!nextMaxId || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const params = new URLSearchParams({ accountId: id, maxId: nextMaxId });
      const response = await fetch(`/api/neodb/timeline?${params.toString()}`);

      if (!response.ok) throw new Error("activity fetch failed");

      const payload = (await response.json()) as TimelineResponse;

      setStatuses((current) => {
        const nextStatuses = mergeActivityStatuses(current, payload.statuses);

        if (account) {
          writeUserProfileCache(id, {
            account,
            hasMore: payload.hasMore,
            nextMaxId: payload.nextMaxId,
            statuses: nextStatuses,
          });
        }

        return nextStatuses;
      });
      setNextMaxId(payload.nextMaxId);
      setHasMore(payload.hasMore);
    } catch {
      showToast(t("timeline.refreshError"), "error");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const hasRestoredScrollRef = useRef(false);

  useEffect(() => {
    if (
      activityState !== "ready" ||
      hasRestoredScrollRef.current ||
      window.sessionStorage.getItem(`${USER_PROFILE_RESTORE_PREFIX}${id}`) !== "1"
    ) {
      return;
    }

    hasRestoredScrollRef.current = true;
    const scrollY = Number(
      window.sessionStorage.getItem(`${USER_PROFILE_SCROLL_PREFIX}${id}`) || 0,
    );

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.scrollTo({ behavior: "instant", top: Math.max(0, scrollY) });
        window.sessionStorage.removeItem(`${USER_PROFILE_RESTORE_PREFIX}${id}`);
      });
    });
  }, [activityState, id, statuses.length]);

  const handleActivityItemNavigate = useCallback(() => {
    window.sessionStorage.setItem(
      `${USER_PROFILE_SCROLL_PREFIX}${id}`,
      String(window.scrollY),
    );
    window.sessionStorage.setItem(`${USER_PROFILE_RESTORE_PREFIX}${id}`, "1");
  }, [id]);

  const updateStatus: UpdateActivityStatus = useCallback(
    (postId, update) => {
      setStatuses((current) => {
        const nextStatuses = current.map((status) =>
          status.id === postId ? update(status) : status,
        );

        if (account) {
          writeUserProfileCache(id, { account, hasMore, nextMaxId, statuses: nextStatuses });
        }

        return nextStatuses;
      });
    },
    [account, hasMore, id, nextMaxId],
  );

  const deleteStatus = useCallback(
    (postId: string) => {
      setStatuses((current) => {
        const nextStatuses = current.filter((status) => status.id !== postId);

        if (account) {
          writeUserProfileCache(id, { account, hasMore, nextMaxId, statuses: nextStatuses });
        }

        return nextStatuses;
      });
    },
    [account, hasMore, id, nextMaxId],
  );

  function handleRelationshipChange(
    next: Partial<Pick<AccountProfile, "blocking" | "followedBy" | "following" | "requested">>,
  ) {
    setAccount((current) => {
      if (!current) return current;

      const nextAccount = { ...current, ...next };
      writeUserProfileCache(id, { account: nextAccount, hasMore, nextMaxId, statuses });

      return nextAccount;
    });
  }

  function handleBioChange(nextBio: string) {
    setAccount((current) => {
      if (!current) return current;

      const nextAccount = { ...current, bio: nextBio };
      writeUserProfileCache(id, { account: nextAccount, hasMore, nextMaxId, statuses });

      return nextAccount;
    });
  }

  return (
    <>
      <UserProfileTopBar
        account={accountState === "ready" ? account : null}
        onBeforeClose={() => clearUserProfileCache(id)}
        onRelationshipChange={handleRelationshipChange}
      />
      <main
        className="detail-page-enter relative min-h-dvh overflow-hidden bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-detail-page
      >
        {account ? <UserHeatmapBackdrop handle={account.username} /> : null}

        <section className="relative z-10 mx-auto flex max-w-2xl flex-col gap-8">
          {accountState === "loading" ? (
            <UserProfileHeaderSkeleton />
          ) : accountState === "guest" ? (
            <UserProfileEmptyState text={t("userProfile.loginRequired")} />
          ) : accountState === "error" || !account ? (
            <UserProfileEmptyState text={t("userProfile.loadError")} />
          ) : (
            <UserProfileHeader account={account} onBioChange={handleBioChange} />
          )}

          {accountState === "ready" && account ? (
            <section id={USER_PROFILE_ACTIVITY_ID}>
              <h2 className="mb-4 ml-4 text-xs font-bold uppercase tracking-[0.18em] text-[#75777d]">
                {t("userProfile.recentActivity")}
              </h2>
              {activityState === "loading" ? (
                <TimelineListSkeleton />
              ) : activityState === "error" ? (
                <UserProfileEmptyState text={t("userProfile.activityError")} />
              ) : statuses.length === 0 ? (
                <UserProfileEmptyState text={t("userProfile.activityEmpty")} />
              ) : (
                <>
                  <ActivityCardList
                    hideAuthor
                    onDelete={deleteStatus}
                    onNavigate={handleActivityItemNavigate}
                    statuses={statuses}
                    updateStatus={updateStatus}
                  />
                  {hasMore ? (
                    <div className="mt-5 flex justify-center">
                      <button
                        className="h-10 rounded-full border border-white/70 bg-white/60 px-5 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/80 active:scale-95 disabled:cursor-wait disabled:text-[#a4a6ad]"
                        disabled={isLoadingMore}
                        onClick={loadMoreActivity}
                        type="button"
                      >
                        {isLoadingMore ? t("timeline.loadingMore") : t("timeline.loadMore")}
                      </button>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          ) : null}
        </section>
      </main>
      <BackToTopButton
        compactVisible={hasScrolledPastActivityStart}
        compactTop="5rem"
        onBackToTop={() => {
          const target = document.getElementById(USER_PROFILE_ACTIVITY_ID);
          if (!target) return;
          const top =
            window.scrollY +
            target.getBoundingClientRect().top -
            USER_PROFILE_ACTIVITY_TOP_OFFSET;
          window.scrollTo({ behavior: "smooth", top: Math.max(0, top) });
        }}
        wideRight="max(1.25rem, calc(50vw - 27rem))"
        wideVisible={hasScrolledPastActivityStart}
      />
    </>
  );
}

function UserProfileTopBar({
  account,
  onBeforeClose,
  onRelationshipChange,
}: {
  account: AccountProfile | null;
  onBeforeClose: () => void;
  onRelationshipChange: (
    next: Partial<Pick<AccountProfile, "blocking" | "followedBy" | "following" | "requested">>,
  ) => void;
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
        <CloseDetailButton onBeforeClose={onBeforeClose} />
        {account ? (
          <TopBarAccountSummary
            avatar={account.avatar}
            displayName={account.displayName}
            emojis={account.emojis}
          />
        ) : (
          <div className="min-w-0 flex-1" />
        )}
        {account && (!account.isSelf || account.links.length > 0) ? (
          <div className="flex shrink-0 items-center gap-1">
            {!account.isSelf ? (
              <FollowButton account={account} onChange={onRelationshipChange} />
            ) : null}
            <AccountMoreMenu account={account} onChange={onRelationshipChange} />
          </div>
        ) : null}
      </div>
    </header>
  );
}

function TopBarAccountSummary({
  avatar,
  displayName,
  emojis,
}: {
  avatar: string;
  displayName: string;
  emojis: MastodonEmoji[];
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    function measureTitle() {
      const frame = frameRef.current;
      const titleNode = titleRef.current;

      if (!frame || !titleNode) {
        return;
      }

      setIsOverflowing(titleNode.scrollWidth > frame.clientWidth);
    }

    measureTitle();

    const observer = new ResizeObserver(measureTitle);

    if (frameRef.current) {
      observer.observe(frameRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [displayName]);

  const renderedName = renderTextWithEmoji(displayName, emojis);

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2.5">
      <TopBarAvatar avatar={avatar} displayName={displayName} />
      <div
        className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-sm font-bold text-[#1a1c1e]"
        ref={frameRef}
      >
        {isOverflowing ? (
          <span className="detail-title-marquee inline-flex">
            <span className="pr-6">{renderedName}</span>
            <span aria-hidden="true" className="pr-6">
              {renderedName}
            </span>
          </span>
        ) : (
          <span>{renderedName}</span>
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none invisible absolute whitespace-nowrap"
          ref={titleRef}
        >
          {renderedName}
        </span>
      </div>
    </div>
  );
}

function AccountMoreMenu({
  account,
  onChange,
}: {
  account: AccountProfile;
  onChange: (
    next: Partial<Pick<AccountProfile, "blocking" | "followedBy" | "following" | "requested">>,
  ) => void;
}) {
  const t = useT();
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLinksOpen, setIsLinksOpen] = useState(false);

  async function submit(action: "block" | "unblock") {
    if (isBusy) return;

    setIsBusy(true);
    setIsConfirmOpen(false);

    try {
      const response = await fetch("/api/neodb/account", {
        body: JSON.stringify({ accountId: account.id, action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            relationship?: {
              blocking?: boolean;
              followed_by?: boolean;
              following?: boolean;
              requested?: boolean;
            };
          }
        | null;

      if (!response.ok) throw new Error("block_action_failed");

      onChange({
        blocking: Boolean(payload?.relationship?.blocking),
        followedBy: Boolean(payload?.relationship?.followed_by),
        following: Boolean(payload?.relationship?.following),
        requested: Boolean(payload?.relationship?.requested),
      });
      showToast(
        action === "block" ? t("userProfile.blocked") : t("userProfile.unblocked"),
      );
    } catch {
      showToast(t("profile.follows.actionError"), "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      <ActionMenu
        buttonClassName="size-8 -mr-4"
        items={[
          {
            icon: <ShareIcon />,
            label: t("detail.tools.share"),
            onClick: async () => {
              const shared = await shareContent({ url: account.url || window.location.href });
              if (!shared) showToast(t("profile.loggedIn.copied"));
            },
          },
          account.links.length > 0
            ? {
                icon: <FediverseIcon />,
                label: t("userProfile.relatedLinks"),
                onClick: () => setIsLinksOpen(true),
              }
            : null,
          account.isSelf
            ? null
            : account.blocking
              ? {
                  disabled: isBusy,
                  icon: <BlockIcon />,
                  label: t("userProfile.unblock"),
                  onClick: () => submit("unblock"),
                }
              : {
                  disabled: isBusy,
                  icon: <BlockIcon />,
                  label: t("userProfile.block"),
                  onClick: () => setIsConfirmOpen(true),
                  tone: "danger" as const,
                },
        ].filter((item): item is NonNullable<typeof item> => Boolean(item))}
        label={t("timeline.moreActions")}
      />

      {isConfirmOpen ? (
        <ConfirmDialog
          confirmLabel={t("userProfile.blockConfirm")}
          description={t("userProfile.blockConfirmDesc")}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => submit("block")}
          title={t("userProfile.blockConfirmTitle").replace(
            "{name}",
            account.displayName || account.username,
          )}
        />
      ) : null}

      {isLinksOpen ? (
        <Suspense fallback={null}>
          <LazyRelatedLinksDialog
            links={account.links.map((link) => toRelatedLink(link, t))}
            onClose={() => setIsLinksOpen(false)}
            title={t("userProfile.relatedLinks")}
          />
        </Suspense>
      ) : null}
    </>
  );
}

function toRelatedLink(
  link: ProfileLink,
  t: (key: string) => string,
): RelatedLink {
  if (link.kind === "neodb") {
    return {
      href: link.href,
      iconPath: "/icons/external/neodb.png",
      label: t("userProfile.viewOnNeodb").replace("{server}", siteConfig.neodbName),
    };
  }

  if (link.kind === "mastodon") {
    return { href: link.href, iconPath: "/icons/external/mastodon.png", label: t("userProfile.viewOnMastodon") };
  }

  return { href: link.href, iconPath: "/globe.svg", label: link.hostname };
}

function FediverseIcon() {
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
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" />
    </svg>
  );
}

function BlockIcon() {
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
      <circle cx="12" cy="12" r="9" />
      <path d="m5.5 5.5 13 13" />
    </svg>
  );
}

function TopBarAvatar({
  avatar,
  displayName,
}: {
  avatar: string;
  displayName: string;
}) {
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <div className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-full border border-white/70 bg-[#dde3eb] text-xs font-bold text-[#333e50]">
      {avatar && !avatarFailed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="size-full object-cover"
          onError={() => setAvatarFailed(true)}
          src={avatar}
        />
      ) : (
        displayName.slice(0, 1)
      )}
    </div>
  );
}

function FollowButton({
  account,
  onChange,
}: {
  account: AccountProfile;
  onChange: (next: { following: boolean; requested: boolean }) => void;
}) {
  const t = useT();
  const [isBusy, setIsBusy] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  async function submit(action: "follow" | "unfollow") {
    if (isBusy) return;

    setIsBusy(true);
    setIsConfirmOpen(false);

    try {
      const response = await fetch("/api/neodb/follows", {
        body: JSON.stringify({ accountId: account.id, action }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as
        | { relationship?: { following?: boolean; requested?: boolean } }
        | null;

      if (!response.ok) throw new Error("follow_action_failed");

      const requested = Boolean(payload?.relationship?.requested);

      // A freshly created follow starts in a transient "unrequested" state
      // server-side and only flips its relationship's `following` flag once
      // a background worker advances it to "accepted", so the response right
      // after a successful "follow" request can still report following:
      // false. Treat the request as followed immediately unless the account
      // actually requires manual approval (requested: true).
      onChange({
        following:
          action === "follow"
            ? Boolean(payload?.relationship?.following) || !requested
            : Boolean(payload?.relationship?.following),
        requested,
      });
    } catch {
      showToast(t("profile.follows.actionError"), "error");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <>
      {account.following ? (
        <button
          className="h-9 shrink-0 rounded-full border border-[#c5c6cd]/70 bg-white/55 px-4 text-xs font-bold text-[#44474c] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => setIsConfirmOpen(true)}
          type="button"
        >
          {t("profile.follows.followingButton")}
        </button>
      ) : (
        <button
          className="h-9 shrink-0 rounded-full bg-[var(--theme-primary)] px-4 text-xs font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => void submit("follow")}
          type="button"
        >
          {account.requested
            ? t("profile.follows.requested")
            : account.followedBy
              ? t("profile.follows.followBack")
              : t("profile.follows.follow")}
        </button>
      )}

      {isConfirmOpen ? (
        <ConfirmDialog
          confirmLabel={t("profile.follows.unfollowConfirm")}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={() => submit("unfollow")}
          title={t("profile.follows.unfollowTitle").replace(
            "{name}",
            account.displayName || account.username,
          )}
        />
      ) : null}
    </>
  );
}

function UserProfileHeader({
  account,
  onBioChange,
}: {
  account: AccountProfile;
  onBioChange: (nextBio: string) => void;
}) {
  const t = useT();
  const [avatarFailed, setAvatarFailed] = useState(false);

  return (
    <header className="flex flex-col items-center text-center">
      <div className="relative z-10 mb-6 overflow-hidden rounded-full border border-white/80 bg-white/65 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.45)] backdrop-blur-2xl">
        {account.avatar && !avatarFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={account.displayName}
            className="size-32 object-cover"
            onError={() => setAvatarFailed(true)}
            src={account.avatar}
          />
        ) : (
          <div className="grid size-32 place-items-center">
            <PersonIcon />
          </div>
        )}
      </div>

      <h1 className="max-w-full text-2xl font-bold tracking-normal text-[#1a1c1e]">
        {renderTextWithEmoji(account.displayName, account.emojis)}
      </h1>
      <p className="mt-1 max-w-sm text-sm font-semibold text-[#75777d]">
        {formatAccountHandle(account.acct || account.username)}
      </p>
      {account.bio || account.isSelf ? (
        <p className="mt-4 w-full max-w-full whitespace-pre-line break-words px-4 text-left text-sm leading-6 text-[#44474c] [overflow-wrap:anywhere] sm:px-5">
          {account.bio ? (
            <SpoilerText emojis={account.emojis} text={account.bio} />
          ) : (
            t("userProfile.bioEmpty")
          )}
          {account.isSelf ? (
            <BioEditButton bio={account.bio} onBioChange={onBioChange} />
          ) : null}
        </p>
      ) : null}
    </header>
  );
}

function BioEditButton({
  bio,
  onBioChange,
}: {
  bio: string;
  onBioChange: (nextBio: string) => void;
}) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(bio);
  const [status, setStatus] = useState<"idle" | "saving">("idle");

  async function saveBio() {
    if (status === "saving") return;

    setStatus("saving");

    try {
      const response = await fetch("/api/neodb/account-bio", {
        body: JSON.stringify({ bio: draft.trim() }),
        headers: { "Content-Type": "application/json" },
        method: "PATCH",
      });
      const payload = (await response.json().catch(() => null)) as
        | { bio?: string; error?: string }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("userProfile.editBioError"));
      }

      onBioChange(payload?.bio || "");
      showToast(t("userProfile.editBioSuccess"));
      setIsOpen(false);
    } catch {
      showToast(t("userProfile.editBioError"), "error");
    } finally {
      setStatus("idle");
    }
  }

  return (
    <>
      <button
        aria-label={t("userProfile.editBio")}
        className="ml-1.5 inline-grid size-5 place-items-center rounded-full border border-white/70 bg-white/60 align-[-0.18em] text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
        onClick={() => {
          setDraft(bio);
          setIsOpen(true);
        }}
        type="button"
      >
        <BioEditIcon />
      </button>

      {isOpen && typeof document !== "undefined"
        ? createPortal(
            <BioDialog
              draft={draft}
              onChange={setDraft}
              onClose={() => setIsOpen(false)}
              onSave={saveBio}
              status={status}
            />,
            document.body,
          )
        : null}
    </>
  );
}

function BioDialog({
  draft,
  onChange,
  onClose,
  onSave,
  status,
}: {
  draft: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSave: () => void;
  status: "idle" | "saving";
}) {
  const t = useT();

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#e2e2e5]/55 px-5 py-5 backdrop-blur-sm">
      <section className="review-editor-enter max-h-[calc(100dvh_-_2rem_-_env(safe-area-inset-bottom))] w-full max-w-md overflow-y-auto overscroll-contain rounded-[2rem] border border-white/60 bg-white/80 p-5 shadow-2xl shadow-slate-900/15 backdrop-blur-3xl">
        <header className="flex items-center justify-between gap-4 pb-2">
          <h2 className="min-w-0 text-xl font-bold text-[var(--foreground)]">
            {t("userProfile.editBio")}
          </h2>
          <button
            aria-label={t("userProfile.editBioClose")}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full border border-white/60 bg-white/55 text-[#44474c] shadow-sm transition hover:bg-white/85 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
        </header>

        <textarea
          autoFocus
          className="min-h-40 w-full resize-none rounded-[1.5rem] border border-white/60 bg-white/45 p-4 text-base leading-7 text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd]"
          onChange={(event) => onChange(event.target.value)}
          placeholder={t("userProfile.editBioPlaceholder")}
          value={draft}
        />

        <button
          className="mt-5 grid h-12 w-full place-items-center rounded-full bg-[var(--theme-primary)] text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-[0.98] disabled:cursor-wait disabled:bg-[#c1c7cf]"
          disabled={status === "saving"}
          onClick={onSave}
          type="button"
        >
          {status === "saving" ? t("userProfile.editBioSaving") : t("userProfile.editBioSave")}
        </button>
      </section>
    </div>
  );
}

function UserProfileHeaderSkeleton() {
  return (
    <header className="flex flex-col items-center text-center">
      <div className="mb-6 size-32 animate-pulse rounded-full border border-white/80 bg-white/55 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.45)] backdrop-blur-2xl" />
      <div className="h-7 w-36 animate-pulse rounded-full bg-[#e2e2e5]" />
      <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
    </header>
  );
}

function UserProfileEmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-10 text-center text-sm font-semibold text-[#75777d] shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
      {text}
    </div>
  );
}

function mergeActivityStatuses(current: TimelineStatus[], incoming: TimelineStatus[]) {
  const ids = new Set(current.map((status) => status.id));
  return [...current, ...incoming.filter((status) => !ids.has(status.id))];
}

function formatAccountHandle(value: string) {
  if (!value) return "";
  return value.startsWith("@") ? value : `@${value}`;
}

function BioEditIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
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

function ShareIcon() {
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
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-16 text-[#75777d]/55"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
    >
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}
