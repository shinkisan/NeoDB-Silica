"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/app-toast";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { renderTextWithEmoji, type MastodonEmoji } from "@/lib/mastodon-emoji";

export type FollowListType = "followers" | "following";

export type FollowAccount = {
  acct: string;
  avatar: string;
  displayName: string;
  emojis?: MastodonEmoji[];
  followedBy: boolean;
  following: boolean;
  id: string;
  requested: boolean;
  url: string;
  username: string;
};

type FollowListResponse = {
  error?: string;
  items?: FollowAccount[];
  nextMaxId?: string | null;
};

export function ProfileFollowsPage({ type }: { type: FollowListType }) {
  const t = useT();
  const title = t(`profile.follows.${type}.title`);

  return (
    <>
      <ProfileFollowsTopBar pageSelector="[data-profile-follows-page]" title={title} />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-follows-page
      >
        <section className="mx-auto max-w-2xl">
          <ProfileFollowsList type={type} />
        </section>
      </main>
    </>
  );
}

function ProfileFollowsTopBar({
  pageSelector,
  title,
}: {
  pageSelector: string;
  title: string;
}) {
  const router = useRouter();

  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3">
        <button
          aria-label={title}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70"
          onClick={() => {
            document.querySelector(pageSelector)?.classList.add("detail-page-exit");

            window.setTimeout(() => {
              router.push("/profile");
            }, 180);
          }}
          type="button"
        >
          <CloseIcon />
        </button>
        <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--foreground)]">
          {title}
        </p>
      </div>
    </header>
  );
}

function ProfileFollowsList({ type }: { type: FollowListType }) {
  const t = useT();
  const [items, setItems] = useState<FollowAccount[]>([]);
  const [nextMaxId, setNextMaxId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "guest">(
    "loading",
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<FollowAccount | null>(null);
  const [busyAccountId, setBusyAccountId] = useState<string | null>(null);
  const busyAccountIdRef = useRef<string | null>(null);

  useEffect(() => {
    busyAccountIdRef.current = busyAccountId;
  }, [busyAccountId]);

  useEffect(() => {
    let cancelled = false;

    setStatus("loading");
    setItems([]);
    setNextMaxId(null);

    fetchFollowList(type)
      .then((payload) => {
        if (cancelled) return;
        setItems(payload.items || []);
        setNextMaxId(payload.nextMaxId || null);
        setStatus("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        setStatus(error instanceof UnauthorizedError ? "guest" : "error");
      });

    return () => {
      cancelled = true;
    };
  }, [type]);

  async function loadMore() {
    if (!nextMaxId || isLoadingMore) return;

    setIsLoadingMore(true);

    try {
      const payload = await fetchFollowList(type, nextMaxId);
      setItems((current) => mergeAccounts(current, payload.items || []));
      setNextMaxId(payload.nextMaxId || null);
    } catch {
      showToast(t("profile.follows.loadError"), "error");
    } finally {
      setIsLoadingMore(false);
    }
  }

  const updateAccount = useCallback((id: string, patch: Partial<FollowAccount>) => {
    setItems((current) =>
      current.map((entry) => (entry.id === id ? { ...entry, ...patch } : entry)),
    );
  }, []);

  const followBack = useCallback(
    async (account: FollowAccount) => {
      if (busyAccountIdRef.current) return;

      setBusyAccountId(account.id);

      try {
        const relationship = await submitFollowAction(account.id, "follow");
        const requested = Boolean(relationship.requested);

        // A freshly created follow starts in a transient "unrequested" state
        // server-side and only flips its relationship's `following` flag once
        // a background worker advances it to "accepted", so the API response
        // right after this request still reports following: false even on
        // success. Treat the request as followed immediately unless the
        // account actually requires manual approval (requested: true).
        updateAccount(account.id, {
          following: Boolean(relationship.following) || !requested,
          requested,
        });
      } catch {
        showToast(t("profile.follows.actionError"), "error");
      } finally {
        setBusyAccountId(null);
      }
    },
    [t, updateAccount],
  );

  const unfollow = useCallback(
    async (account: FollowAccount) => {
      if (busyAccountIdRef.current) return;

      setBusyAccountId(account.id);

      try {
        await submitFollowAction(account.id, "unfollow");
        if (type === "following") {
          setItems((current) => current.filter((entry) => entry.id !== account.id));
        } else {
          updateAccount(account.id, { following: false, requested: false });
        }
        setPendingAccount(null);
      } catch {
        showToast(t("profile.follows.actionError"), "error");
      } finally {
        setBusyAccountId(null);
      }
    },
    [type, t, updateAccount],
  );

  if (status === "loading") return <ProfileFollowsSkeleton />;

  if (status === "guest") {
    return <ProfileFollowsEmpty text={t("profile.follows.loginRequired")} />;
  }

  if (status === "error") {
    return <ProfileFollowsEmpty text={t("profile.follows.loadError")} />;
  }

  return (
    <>
      {items.length ? (
        <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
          {items.map((account) => (
            <FollowAccountCard
              account={account}
              isBusy={busyAccountId === account.id}
              key={account.id}
              onFollow={followBack}
              onUnfollow={setPendingAccount}
            />
          ))}
        </div>
      ) : (
        <ProfileFollowsEmpty text={t(`profile.follows.${type}.empty`)} />
      )}

      {nextMaxId ? (
        <div className="mt-5 flex justify-center">
          <button
            className="rounded-full border border-white/60 bg-white/60 px-5 py-2 text-sm font-bold text-[#44474c] shadow-sm transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoadingMore}
            onClick={loadMore}
            type="button"
          >
            {isLoadingMore
              ? t("profile.follows.loading")
              : t("profile.follows.loadMore")}
          </button>
        </div>
      ) : null}

      {pendingAccount ? (
        <ConfirmDialog
          confirmLabel={t("profile.follows.unfollowConfirm")}
          onCancel={() => setPendingAccount(null)}
          onConfirm={() => unfollow(pendingAccount)}
          title={t("profile.follows.unfollowTitle").replace(
            "{name}",
            getAccountName(pendingAccount),
          )}
        />
      ) : null}
    </>
  );
}

const FollowAccountCard = memo(function FollowAccountCard({
  account,
  isBusy,
  onFollow,
  onUnfollow,
}: {
  account: FollowAccount;
  isBusy: boolean;
  onFollow: (account: FollowAccount) => void;
  onUnfollow: (account: FollowAccount) => void;
}) {
  const t = useT();
  const isFollowing = account.following;

  const userHref = `/user/${encodeURIComponent(account.id)}`;

  function openUserProfile() {
    pushNavigationFrame("detail", userHref);
  }

  return (
    <article className="flex min-w-0 items-center gap-3 border-b border-[#c5c6cd]/30 p-4 last:border-0">
      <Link
        className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-[#dde3eb] text-sm font-bold text-[#333e50]"
        href={userHref}
        onClick={openUserProfile}
      >
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt=""
            className="size-full object-cover"
            loading="lazy"
            src={account.avatar}
          />
        ) : (
          getAccountName(account).slice(0, 1)
        )}
      </Link>
      <Link className="min-w-0 flex-1" href={userHref} onClick={openUserProfile}>
        <h2 className="truncate text-sm font-bold text-[var(--foreground)]">
          {renderTextWithEmoji(
            account.displayName || account.username || account.acct,
            account.emojis,
          )}
        </h2>
        <p className="mt-0.5 truncate text-xs font-semibold text-[#75777d]">
          {formatAccountHandle(account.acct)}
        </p>
      </Link>
      {isFollowing ? (
        <button
          className="h-9 shrink-0 rounded-full border border-[#c5c6cd]/70 bg-white/55 px-3 text-xs font-bold text-[#44474c] transition hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => onUnfollow(account)}
          type="button"
        >
          {t("profile.follows.followingButton")}
        </button>
      ) : (
        <button
          className="h-9 shrink-0 rounded-full bg-[var(--theme-primary)] px-3 text-xs font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isBusy}
          onClick={() => onFollow(account)}
          type="button"
        >
          {account.requested
            ? t("profile.follows.requested")
            : t("profile.follows.followBack")}
        </button>
      )}
    </article>
  );
});

function ProfileFollowsSkeleton() {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/60 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
      {Array.from({ length: 8 }, (_, index) => (
        <div
          className="flex items-center gap-3 border-b border-[#c5c6cd]/30 p-4 last:border-0"
          key={index}
        >
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-32 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
          </div>
          <div className="h-9 w-16 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      ))}
    </div>
  );
}

function ProfileFollowsEmpty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/60 px-5 py-10 text-center text-sm font-semibold text-[#75777d] shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
      {text}
    </div>
  );
}

async function fetchFollowList(type: FollowListType, maxId?: string | null) {
  const params = new URLSearchParams({ type });
  if (maxId) params.set("maxId", maxId);

  const response = await fetch(`/api/neodb/follows?${params.toString()}`, {
    cache: "no-store",
  });
  const payload = (await response.json().catch(() => null)) as FollowListResponse | null;

  if (response.status === 401) throw new UnauthorizedError();
  if (!response.ok) throw new Error(payload?.error || "follow_list_failed");

  return {
    items: payload?.items || [],
    nextMaxId: payload?.nextMaxId || null,
  };
}

async function submitFollowAction(
  accountId: string,
  action: "follow" | "unfollow",
) {
  const response = await fetch("/api/neodb/follows", {
    body: JSON.stringify({ accountId, action }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  const payload = (await response.json().catch(() => null)) as
    | { relationship?: { following?: boolean; requested?: boolean }; error?: string }
    | null;

  if (!response.ok) throw new Error(payload?.error || "follow_action_failed");
  return payload?.relationship || {};
}

function mergeAccounts(current: FollowAccount[], incoming: FollowAccount[]) {
  const seen = new Set(current.map((account) => account.id));
  return [
    ...current,
    ...incoming.filter((account) => {
      if (seen.has(account.id)) return false;
      seen.add(account.id);
      return true;
    }),
  ];
}

function getAccountName(account: FollowAccount) {
  return account.displayName || account.username || account.acct;
}

function formatAccountHandle(value: string) {
  if (!value) return "";
  return value.startsWith("@") ? value : `@${value}`;
}

class UnauthorizedError extends Error {}

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
