"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { pushNavigationFrame } from "@/components/navigation-history";
import { useT } from "@/components/use-t";
import { renderTextWithEmoji, type MastodonEmoji } from "@/lib/mastodon-emoji";

type NeodbUser = {
  avatar: string;
  display_name: string;
  emojis?: MastodonEmoji[];
  external_accounts?: Array<{ acct?: string; url?: string }>;
  external_acct?: string | null;
  followers_count?: number;
  following_count?: number;
  id?: string;
  roles: string[];
  statuses_count?: number;
  url: string;
  username: string;
};

const PROFILE_CACHE_KEY = "bielu:v1:profile:user";
const PROFILE_AVATAR_CACHE_PREFIX = "bielu:v1:profile:avatar:";

export function ProfileHeader({
  hasSession,
  initialUser,
}: {
  hasSession: boolean;
  initialUser: NeodbUser | null;
}) {
  const [user, setUser] = useState<NeodbUser | null>(initialUser);
  const [isLoaded, setIsLoaded] = useState(!hasSession || Boolean(initialUser));

  useEffect(() => {
    let cancelled = false;

    if (!hasSession) {
      window.localStorage.removeItem(PROFILE_CACHE_KEY);
      window.queueMicrotask(() => {
        if (cancelled) {
          return;
        }

        setUser(null);
        setIsLoaded(true);
      });
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
        if (cancelled || !nextUser) {
          return;
        }

        setUser(nextUser);
        writeProfileCache(nextUser);
        setIsLoaded(true);
      })
      .catch(() => {
        if (!cancelled) {
          setIsLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasSession]);

  if (user) {
    return <LoggedInHeader user={user} />;
  }

  if (hasSession && !isLoaded) {
    return <ProfileHeaderSkeleton />;
  }

  return <LoggedOutHeader />;
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

function readTextCache(key: string) {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(key);
}

function writeTextCache(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Avatar caching is a visual optimization; storage pressure should not break profile rendering.
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      resolve(String(reader.result || ""));
    });
    reader.addEventListener("error", () => {
      reject(reader.error || new Error("avatar cache failed"));
    });
    reader.readAsDataURL(blob);
  });
}

function ProfileHeaderSkeleton() {
  return (
    <header className="flex flex-col items-center pt-8 text-center">
      <div className="mb-6 size-32 animate-pulse rounded-full border border-white/80 bg-white/55 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.45)] backdrop-blur-2xl" />
      <div className="h-7 w-36 animate-pulse rounded-full bg-[#e2e2e5]" />
      <div className="mt-3 h-4 w-24 animate-pulse rounded-full bg-[#e2e2e5]" />
      <ProfileStatsSkeleton />
      <div className="mt-6 h-12 w-40 animate-pulse rounded-full bg-[#e2e2e5]" />
    </header>
  );
}

function LoggedOutHeader() {
  const t = useT();
  return (
    <header className="flex flex-col items-center pt-8 text-center">
      <div className="relative mb-6">
        <div className="relative z-10 grid size-32 place-items-center overflow-hidden rounded-full border border-white/80 bg-white/55 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.45)] backdrop-blur-2xl">
          <PersonIcon />
        </div>
      </div>

      <h1 className="text-2xl font-bold tracking-normal text-[#1a1c1e]">
        {t("profile.loggedOut.title")}
      </h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-[#75777d]">
        {t("profile.loggedOut.description")}
      </p>

      <div className="mt-6 flex items-center gap-3">
        <a
          className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[var(--theme-primary-hover)]"
          href="/api/auth/neodb/login"
        >
          <LoginIcon />
          {t("profile.loggedOut.login")}
        </a>
      </div>
    </header>
  );
}

function LoggedInHeader({ user }: { user: NeodbUser }) {
  const t = useT();
  const externalAccount =
    user.external_accounts?.find((account) => account.acct)?.acct ||
    user.external_acct ||
    "";
  const displayName = user.display_name || user.username;
  const accountHandle = getAccountHandle(user, externalAccount);

  return (
    <header className="flex flex-col items-center pt-8 text-center">
      <div className="relative z-10 mb-6 overflow-hidden rounded-full border border-white/80 bg-white/65 shadow-[0_18px_48px_-18px_rgba(74,85,104,0.45)] backdrop-blur-2xl">
        {user.avatar ? (
          <CachedAvatar alt={displayName} key={user.avatar} src={user.avatar} />
        ) : (
          <div className="grid size-32 place-items-center">
            <PersonIcon />
          </div>
        )}
      </div>

      <h1 className="max-w-full text-2xl font-bold tracking-normal text-[#1a1c1e]">
        {renderTextWithEmoji(displayName, user.emojis)}
      </h1>
      <p className="mt-1 max-w-sm text-sm font-semibold text-[#75777d]">
        {accountHandle}
      </p>

      <div className="mt-6 grid grid-cols-3 gap-8">
        <ProfileStat
          href="/profile/following"
          label={t("profile.loggedIn.following")}
          value={user.following_count}
        />
        <ProfileStat
          href="/profile/followers"
          label={t("profile.loggedIn.followers")}
          value={user.followers_count}
        />
        <ProfileStat
          href="/timeline?view=mine"
          label={t("profile.loggedIn.statuses")}
          value={user.statuses_count}
        />
      </div>

      <div className="mt-6 flex items-center gap-3">
        {user.id ? (
          <Link
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[var(--theme-primary-hover)]"
            href={`/user/${encodeURIComponent(user.id)}`}
            onClick={() => pushNavigationFrame("detail", `/user/${encodeURIComponent(user.id!)}`)}
          >
            <PersonIconSmall />
            {t("profile.loggedIn.viewProfile")}
          </Link>
        ) : (
          <Link
            className="inline-flex h-12 items-center gap-2 rounded-full bg-[var(--theme-primary)] px-6 text-sm font-bold text-white shadow-lg shadow-slate-900/10 transition hover:bg-[var(--theme-primary-hover)]"
            href={user.url}
            target="_blank"
          >
            <OpenIconSmall />
            {t("profile.loggedIn.viewProfile")}
          </Link>
        )}
      </div>
    </header>
  );
}

function ProfileStat({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: number | undefined;
}) {
  const content = (
    <div className="min-w-14">
      <div className="text-xl font-bold leading-6 text-[#1a1c1e]">
        {typeof value === "number" ? value.toLocaleString() : "—"}
      </div>
      <div className="mt-1 text-xs font-semibold text-[#75777d]">{label}</div>
    </div>
  );

  return href ? (
    <Link
      className="rounded-xl transition hover:bg-white/35 active:scale-95"
      href={href}
    >
      {content}
    </Link>
  ) : content;
}

function ProfileStatsSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-3 gap-8">
      {Array.from({ length: 3 }, (_, index) => (
        <div className="flex min-w-14 flex-col items-center" key={index}>
          <div className="h-6 w-10 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="mt-1 h-3 w-12 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      ))}
    </div>
  );
}

function getAccountHandle(user: NeodbUser, externalAccount: string) {
  const normalizedExternalAccount = normalizeAccountHandle(externalAccount);

  if (normalizedExternalAccount.includes("@", 1)) {
    return normalizedExternalAccount;
  }

  const instance = getInstanceFromUrl(user.url);

  if (instance) {
    return `@${user.username}@${instance}`;
  }

  return `@${user.username}`;
}

function normalizeAccountHandle(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
}

function getInstanceFromUrl(value: string) {
  try {
    return new URL(value).hostname;
  } catch {
    return "";
  }
}

function CachedAvatar({ alt, src }: { alt: string; src: string }) {
  const cacheKey = `${PROFILE_AVATAR_CACHE_PREFIX}${src}`;
  const [avatarSrc, setAvatarSrc] = useState(src);

  useEffect(() => {
    let cancelled = false;

    async function syncAvatarCache() {
      const cachedAvatar = readTextCache(cacheKey);

      if (cachedAvatar) {
        if (!cancelled) {
          setAvatarSrc(cachedAvatar);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/neodb/avatar?url=${encodeURIComponent(src)}`,
        );

        if (!response.ok) {
          return;
        }

        const blob = await response.blob();

        if (!blob || cancelled || blob.size > 512 * 1024) {
          return;
        }

        const dataUrl = await blobToDataUrl(blob);

        if (!dataUrl || cancelled) {
          return;
        }

        writeTextCache(cacheKey, dataUrl);
        setAvatarSrc(dataUrl);
      } catch {
        // The remote avatar URL remains usable if local image caching fails.
      }
    }

    syncAvatarCache();

    return () => {
      cancelled = true;
    };
  }, [cacheKey, src]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={alt} className="size-32 object-cover" src={avatarSrc} />
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

function LoginIcon() {
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
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <path d="m10 17 5-5-5-5" />
      <path d="M15 12H3" />
    </svg>
  );
}


function PersonIconSmall() {
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
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="8" r="4" />
    </svg>
  );
}

function OpenIconSmall() {
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
