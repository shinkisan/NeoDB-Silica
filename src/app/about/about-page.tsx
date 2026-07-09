import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NEODB_GITHUB_URL, SILICA_GITHUB_URL } from "@/lib/attribution-links";
import { SITE_PUBLIC_ORIGIN, getIndexableRobots } from "@/lib/seo";
import { siteConfig } from "@/site.config";

export type AboutLocale = "en" | "zh-Hans" | "zh-Hant";

/**
 * This page is intentionally minimal: a deliberate, deployer-owned template
 * rather than fixed marketing copy. The default content is just a one-line
 * credit to NeoDB and NeoDB Silica (this open-source project); deployers are
 * expected to edit `getContent` below directly (per locale) to describe their
 * own instance, add an FAQ, privacy notes, or anything else — the
 * multi-locale/route structure is kept, the words are not.
 */
type AboutContent = {
  appAction: string;
  closeLabel: string;
  creditMiddle: string;
  creditPrefix: string;
  creditSuffix: string;
  languageLabel: string;
  metadataDescription: string;
  metadataTitle: string;
  siteName: string;
};

const paths: Record<AboutLocale, string> = {
  en: "/en/about",
  "zh-Hans": "/about",
  "zh-Hant": "/zh-Hant/about",
};

const languageNames: Record<AboutLocale, string> = {
  en: "English",
  "zh-Hans": "简体中文",
  "zh-Hant": "正體中文",
};

// The PWA icon is the only brand image the About page references (in structured
// data). The page itself is intentionally image-free so it works as a neutral,
// minimal template.
const APP_ICON_PATH = "/icons/icon-512.png";

export function getAboutMetadata(locale: AboutLocale): Metadata {
  const content = getContent(locale);
  const path = paths[locale];

  return {
    alternates: {
      canonical: path,
      languages: {
        en: paths.en,
        "x-default": paths["zh-Hans"],
        "zh-Hans": paths["zh-Hans"],
        "zh-Hant": paths["zh-Hant"],
      },
    },
    description: content.metadataDescription,
    openGraph: {
      description: content.metadataDescription,
      locale: getOpenGraphLocale(locale),
      siteName: content.siteName,
      title: content.metadataTitle,
      type: "website",
      url: path,
    },
    robots: getIndexableRobots(),
    title: content.metadataTitle,
    twitter: {
      card: "summary",
      description: content.metadataDescription,
      title: content.metadataTitle,
    },
  };
}

export function AboutPage({
  fromProfile,
  locale,
}: {
  fromProfile: boolean;
  locale: AboutLocale;
}) {
  const content = getContent(locale);
  const path = paths[locale];
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    applicationCategory: "LifestyleApplication",
    description: content.metadataDescription,
    image: `${SITE_PUBLIC_ORIGIN}${APP_ICON_PATH}`,
    inLanguage: locale,
    isAccessibleForFree: true,
    name: content.siteName,
    operatingSystem: "Web, iOS, Android, Windows, macOS",
    url: `${SITE_PUBLIC_ORIGIN}${path}`,
  };

  return (
    <main
      className="min-h-dvh bg-[var(--background)] pb-32 text-[var(--foreground)]"
      lang={locale}
    >
      <script
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
        type="application/ld+json"
      />

      <header className="sticky top-0 z-50 border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {fromProfile ? (
              <Link
                aria-label={content.closeLabel}
                className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--foreground)] transition hover:bg-white/50"
                href="/profile"
              >
                <CloseIcon />
              </Link>
            ) : null}
            <Link
              className="truncate text-base font-bold text-[var(--foreground)]"
              href="/"
            >
              {content.siteName}
            </Link>
          </div>
          <Link
            className="rounded-full bg-[var(--theme-primary)] px-5 py-2.5 text-sm font-bold text-white shadow-md transition hover:bg-[var(--theme-primary-hover)]"
            href="/"
          >
            {content.appAction}
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-16">
        <h1 className="text-3xl font-bold leading-tight">{content.siteName}</h1>
        <p className="mt-4 text-lg leading-8 text-[#44474c]">
          {content.creditPrefix}
          <CreditLink href={NEODB_GITHUB_URL}>NeoDB</CreditLink>
          {content.creditMiddle}
          <CreditLink href={SILICA_GITHUB_URL}>NeoDB Silica</CreditLink>
          {content.creditSuffix}
        </p>

        {!fromProfile ? (
          <nav
            aria-label={content.languageLabel}
            className="mt-12 flex flex-wrap gap-x-5 gap-y-3 text-sm font-semibold text-[#44474c]"
          >
            {(["zh-Hans", "zh-Hant", "en"] as const).map((targetLocale) => (
              <Link
                aria-current={targetLocale === locale ? "page" : undefined}
                className={
                  targetLocale === locale
                    ? "text-[var(--foreground)] underline underline-offset-4"
                    : "transition hover:text-[var(--foreground)]"
                }
                href={paths[targetLocale]}
                hrefLang={targetLocale}
                key={targetLocale}
              >
                {languageNames[targetLocale]}
              </Link>
            ))}
          </nav>
        ) : null}
      </section>
    </main>
  );
}

function getContent(locale: AboutLocale): AboutContent {
  const name = siteConfig.name;

  if (locale === "en") {
    return {
      appAction: "Open app",
      closeLabel: "Close About page",
      creditMiddle: " and ",
      creditPrefix: `${name} is built on `,
      creditSuffix: ".",
      languageLabel: "Language versions",
      metadataDescription: `${name} is built on NeoDB and NeoDB Silica.`,
      metadataTitle: name,
      siteName: name,
    };
  }

  if (locale === "zh-Hant") {
    return {
      appAction: "開啟應用",
      closeLabel: "關閉關於頁面",
      creditMiddle: " 和 ",
      creditPrefix: `${name} 基於 `,
      creditSuffix: " 建構。",
      languageLabel: "語言版本",
      metadataDescription: `${name} 基於 NeoDB 和 NeoDB Silica 建構。`,
      metadataTitle: name,
      siteName: name,
    };
  }

  return {
    appAction: "打开应用",
    closeLabel: "关闭关于页面",
    creditMiddle: " 和 ",
    creditPrefix: `${name} 基于 `,
    creditSuffix: " 构建。",
    languageLabel: "语言版本",
    metadataDescription: `${name} 基于 NeoDB 和 NeoDB Silica 构建。`,
    metadataTitle: name,
    siteName: name,
  };
}

function CreditLink({ children, href }: { children: ReactNode; href: string }) {
  return (
    <a
      className="underline decoration-[#75777d]/50 underline-offset-4"
      href={href}
      rel="noreferrer"
      target="_blank"
    >
      {children}
    </a>
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

function getOpenGraphLocale(locale: AboutLocale) {
  if (locale === "en") {
    return "en_US";
  }

  return locale === "zh-Hant" ? "zh_TW" : "zh_CN";
}
