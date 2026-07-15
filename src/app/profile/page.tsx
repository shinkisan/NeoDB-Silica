import Link from "next/link";
import { cookies } from "next/headers";
import { getT } from "@/i18n/server";
import { defaultLocale, type Locale, locales } from "@/i18n/config";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  LanguageSelect,
  NightModeSelect,
  ThemeColorSelect,
} from "./appearance-controls";
import {
  AutoForwardButton,
  DefaultVisibilityButton,
} from "./publish-preferences-controls";
import { CacheControlButton } from "./cache-control-button";
import { ChangelogButton } from "./changelog-button";
import { InstallAppButton } from "./install-app-button";
import { LogoutButton } from "./logout-button";
import { ProfileHeader } from "./profile-header";
import { ProfileHeatmapBackdrop } from "./profile-heatmap";
import {
  AboutProfileLink,
  ProfileAboutScrollRestorer,
} from "./about-profile-link";
import { NEODB_GITHUB_URL, SILICA_GITHUB_URL } from "@/lib/attribution-links";
import {
  getConfiguredNeodbHostname,
  getConfiguredNeodbInstance,
} from "@/lib/neodb-instance";
import { configureServerFetchProxy } from "@/lib/server-fetch";
import { siteConfig } from "@/site.config";

export const dynamic = "force-dynamic";

type NeodbUser = {
  avatar: string;
  display_name: string;
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

type MastodonAccount = {
  followers_count?: number;
  following_count?: number;
  id?: string;
  statuses_count?: number;
};

export default async function ProfilePage() {
  const t = await getT();
  const cookieLocale = (await cookies()).get("NEXT_LOCALE")?.value;
  const locale: Locale =
    cookieLocale && (locales as readonly string[]).includes(cookieLocale)
      ? (cookieLocale as Locale)
      : defaultLocale;
  const languageLabel =
    locale === "en" ? "Language" : `${t("profile.language")} (Language)`;
  const aboutHref =
    locale === "en"
      ? "/en/about?from=profile"
      : locale === "zh-Hant"
        ? "/zh-Hant/about?from=profile"
        : "/about?from=profile";
  const session = await getSession();
  const hasSession = Boolean(session?.accessToken);
  const initialUser = session ? await fetchCurrentUser(session) : null;

  return (
    <main className="relative min-h-dvh overflow-hidden bg-[var(--background)] px-5 pb-32 pt-8 text-[var(--foreground)]">
      <ProfileAboutScrollRestorer />
      <ProfileHeatmapBackdrop hasSession={hasSession} initialUser={initialUser} />
      <section className="relative z-10 mx-auto flex max-w-2xl flex-col gap-10">
        <ProfileHeader hasSession={hasSession} initialUser={initialUser} />

        <div className="space-y-8">
          <SettingsGroup title={t("profile.mine")}>
            <Link
              className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
              href="/profile/collections"
            >
              <div className="flex min-w-0 items-center gap-4">
                <IconBubble tone="collection">
                  <CollectionIcon />
                </IconBubble>
                <span className="truncate text-base font-semibold text-[var(--foreground)]">
                  {t("profile.myCollections.item")}
                </span>
              </div>
              <ChevronRightIcon />
            </Link>
            <Link
              className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
              href="/profile/reviews"
            >
              <div className="flex min-w-0 items-center gap-4">
                <IconBubble tone="review">
                  <ReviewIcon />
                </IconBubble>
                <span className="truncate text-base font-semibold text-[var(--foreground)]">
                  {t("profile.myReviews.item")}
                </span>
              </div>
              <ChevronRightIcon />
            </Link>
            <Link
              className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
              href="/profile/tags"
            >
              <div className="flex min-w-0 items-center gap-4">
                <IconBubble tone="tag">
                  <TagIcon />
                </IconBubble>
                <span className="truncate text-base font-semibold text-[var(--foreground)]">
                  {t("profile.myTags.item")}
                </span>
              </div>
              <ChevronRightIcon />
            </Link>
          </SettingsGroup>

          <SettingsGroup title={t("profile.settings")}>
            <SettingsRow
              icon={<LanguageIcon />}
              label={languageLabel}
              right={<LanguageSelect />}
              tone="settings"
            />
            <SettingsRow
              icon={<MoonIcon />}
              label={t("profile.darkMode")}
              right={<NightModeSelect />}
              tone="settings"
            />
            <SettingsRow
              icon={<PaletteIcon />}
              label={t("profile.themeColor")}
              right={<ThemeColorSelect />}
              tone="settings"
            />
            <SettingsRow
              icon={<VisibilityIcon />}
              label={t("profile.defaultVisibility")}
              right={<DefaultVisibilityButton disabled={!hasSession} />}
              tone="settings"
            />
            <SettingsRow
              icon={<ForwardIcon />}
              label={t("profile.autoForward")}
              right={<AutoForwardButton disabled={!hasSession} />}
              tone="settings"
            />
            <SettingsRow
              icon={<InstallIcon />}
              label={t("profile.installApp")}
              right={<InstallAppButton />}
              tone="settings"
            />
            <SettingsRow
              icon={<StorageIcon />}
              label={t("profile.appData")}
              right={<CacheControlButton />}
              tone="settings"
            />
          </SettingsGroup>

          <SettingsGroup title={t("profile.about")}>
            <AboutProfileLink
              href={aboutHref}
              label={t("profile.aboutText").replace("{name}", siteConfig.name)}
            />
            <ChangelogButton />
            {siteConfig.contactEmail ? (
              <Link
                className="flex w-full items-center justify-between border-b-2 border-[#c5c6cd]/30 p-4 transition last:border-0 hover:bg-white/30"
                href={`mailto:${siteConfig.contactEmail}?subject=${encodeURIComponent(t("profile.feedbackSubject"))}`}
              >
                <div className="flex min-w-0 items-center gap-4">
                  <IconBubble tone="neutral">
                    <MailIcon />
                  </IconBubble>
                  <span className="truncate text-base font-semibold text-[var(--foreground)]">
                    {t("profile.feedback")}
                  </span>
                </div>
                <OpenIcon />
              </Link>
            ) : null}
          </SettingsGroup>
        </div>

        <div className="mx-auto mb-2 text-center text-xs leading-5 text-[#a4a6ad]">
          <p>
            {t("profile.serverLabel")}:{" "}
            <a
              className="underline decoration-current/40 underline-offset-2 hover:text-[var(--foreground)]"
              href={getConfiguredNeodbInstance()}
              rel="noreferrer"
              target="_blank"
            >
              {getConfiguredNeodbHostname()}
            </a>
          </p>
          <p>
            {t("profile.poweredByPrefix")}
            <a
              className="underline decoration-current/40 underline-offset-2 hover:text-[var(--foreground)]"
              href={NEODB_GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              NeoDB
            </a>
            {t("profile.poweredByMiddle")}
            <a
              className="underline decoration-current/40 underline-offset-2 hover:text-[var(--foreground)]"
              href={SILICA_GITHUB_URL}
              rel="noreferrer"
              target="_blank"
            >
              NeoDB Silica
            </a>
            {t("profile.poweredBySuffix")}
          </p>
        </div>

        {hasSession ? <LogoutButton /> : null}
      </section>

    </main>
  );
}

async function getSession() {
  const cookieStore = await cookies();
  return openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
}

async function fetchCurrentUser(session: NeodbSessionCookie) {
  configureServerFetchProxy();

  try {
    const headers = {
      Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
    };
    const [response, accountResponse] = await Promise.all([
      fetchWithTimeout(
        `${session.instance}/api/me`,
        { cache: "no-store", headers },
        1200,
      ),
      fetchWithTimeout(
        `${session.instance}/api/v1/accounts/verify_credentials`,
        { cache: "no-store", headers },
        1200,
      ).catch(() => null),
    ]);

    if (!response.ok) {
      return null;
    }

    const user = (await response.json()) as NeodbUser;
    const account = accountResponse?.ok
      ? ((await accountResponse.json()) as MastodonAccount)
      : null;

    return {
      ...user,
      avatar: toAbsoluteUrl(user.avatar, session.instance),
      followers_count: account?.followers_count,
      following_count: account?.following_count,
      id: account?.id,
      statuses_count: account?.statuses_count,
      url: toAbsoluteUrl(user.url, session.instance),
    };
  } catch {
    return null;
  }
}

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  if (!value || /^https?:\/\//.test(value)) {
    return value;
  }

  return new URL(value, baseUrl).toString();
}

function SettingsGroup({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section>
      <h2 className="mb-4 ml-4 text-xs font-bold uppercase tracking-[0.18em] text-[#75777d]">
        {title}
      </h2>
      <div className="overflow-hidden rounded-[2rem] border border-white/60 bg-white/50 shadow-xl shadow-slate-900/5 backdrop-blur-2xl">
        {children}
      </div>
    </section>
  );
}

function SettingsRow({
  icon,
  label,
  right,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  right: React.ReactNode;
  tone: IconTone;
}) {
  return (
    <div className="group flex w-full items-center justify-between gap-4 border-b-2 border-[#c5c6cd]/30 p-4 text-left transition last:border-0 hover:bg-white/30">
      <div className="flex min-w-0 items-center gap-4">
        <IconBubble tone={tone}>{icon}</IconBubble>
        <span className="truncate text-base font-semibold text-[var(--foreground)]">
          {label}
        </span>
      </div>
      <div className="shrink-0">{right}</div>
    </div>
  );
}

function IconBubble({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: IconTone;
}) {
  const toneClassName: Record<IconTone, string> = {
    collection: "bg-[#f7d7df]/75 text-[#8a3f55]",
    neutral: "bg-[#eef0ea] text-[#364046]",
    review: "bg-[#f7d7df]/75 text-[#8a3f55]",
    settings: "bg-[#c9e3d8]/65 text-[#4c635b]",
    tag: "bg-[#f7d7df]/75 text-[#8a3f55]",
  };

  return (
    <span
      className={`grid size-10 shrink-0 place-items-center rounded-full ${toneClassName[tone]}`}
    >
      {children}
    </span>
  );
}

type IconTone = "collection" | "neutral" | "review" | "settings" | "tag";

function PaletteIcon() {
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
      <circle cx="13.5" cy="6.5" r=".5" fill="currentColor" />
      <circle cx="17.5" cy="10.5" r=".5" fill="currentColor" />
      <circle cx="8.5" cy="7.5" r=".5" fill="currentColor" />
      <circle cx="6.5" cy="12.5" r=".5" fill="currentColor" />
      <path d="M12 22a10 10 0 1 1 10-10c0 3.9-3 3.9-4.8 3.9h-1.6a2.2 2.2 0 0 0-2.1 3c.4 1.3-.2 3.1-1.5 3.1Z" />
    </svg>
  );
}

function MoonIcon() {
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
      <path d="M20.9 14.6A8.2 8.2 0 0 1 9.4 3.1 9 9 0 1 0 20.9 14.6Z" />
    </svg>
  );
}

function LanguageIcon() {
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
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

function StorageIcon() {
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
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </svg>
  );
}

function VisibilityIcon() {
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
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function ForwardIcon() {
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
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V8a2 2 0 0 1 2-2h16" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v3a2 2 0 0 1-2 2H3" />
    </svg>
  );
}

function InstallIcon() {
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
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </svg>
  );
}

function CollectionIcon() {
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
      <path d="M4 5a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v14a1 1 0 0 1-1.5.86L12 16l-6.5 3.86A1 1 0 0 1 4 19Z" />
      <path d="M8 7h8M8 11h5" />
    </svg>
  );
}

function ReviewIcon() {
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
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function TagIcon() {
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
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
      <path d="M7.5 7.5h.01" />
    </svg>
  );
}

function MailIcon() {
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
      <path d="M4 6h16v12H4z" />
      <path d="m4 7 8 6 8-6" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function OpenIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5 shrink-0 text-[#75777d]"
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
