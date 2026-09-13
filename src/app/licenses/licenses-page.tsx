import type { Metadata } from "next";
import Link from "next/link";
import type { AboutLocale } from "../about/about-page";
import { siteConfig } from "@/site.config";

type Library = {
  license: "AGPL-3.0" | "Apache-2.0" | "MIT";
  name: string;
  source: string;
  version?: string;
};

const libraries: Library[] = [
  {
    license: "AGPL-3.0",
    name: "NeoDB",
    source: "https://github.com/neodb-social/neodb",
  },
  {
    license: "MIT",
    name: "React / React DOM",
    source: "https://github.com/facebook/react",
    version: "19.2.4",
  },
  {
    license: "MIT",
    name: "Next.js",
    source: "https://github.com/vercel/next.js",
    version: "16.2.10",
  },
  {
    license: "Apache-2.0",
    name: "hls.js",
    source: "https://github.com/video-dev/hls.js",
    version: "1.6.16",
  },
  {
    license: "MIT",
    name: "react-markdown",
    source: "https://github.com/remarkjs/react-markdown",
    version: "10.1.0",
  },
  {
    license: "MIT",
    name: "remark-gfm",
    source: "https://github.com/remarkjs/remark-gfm",
    version: "4.0.1",
  },
  {
    license: "Apache-2.0",
    name: "Sharp",
    source: "https://github.com/lovell/sharp",
    version: "0.34.5",
  },
  {
    license: "MIT",
    name: "Undici",
    source: "https://github.com/nodejs/undici",
    version: "8.7.0",
  },
  {
    license: "MIT",
    name: "unist-util-visit",
    source: "https://github.com/syntax-tree/unist-util-visit",
    version: "5.0.0",
  },
  {
    license: "MIT",
    name: "Vercel Analytics",
    source: "https://github.com/vercel/analytics",
    version: "2.0.1",
  },
  {
    license: "Apache-2.0",
    name: "Vercel Speed Insights",
    source: "https://github.com/vercel/speed-insights",
    version: "2.0.0",
  },
  {
    license: "MIT",
    name: "zxing-wasm",
    source: "https://github.com/Sec-ant/zxing-wasm",
    version: "3.1.4",
  },
  {
    license: "Apache-2.0",
    name: "ZXing-C++",
    source: "https://github.com/zxing-cpp/zxing-cpp",
  },
  {
    license: "MIT",
    name: "liquid-glass",
    source: "https://github.com/nikdelvin/liquid-glass",
  },
];

const paths: Record<AboutLocale, { about: string; licenses: string }> = {
  en: { about: "/en/about", licenses: "/en/licenses" },
  "zh-Hans": { about: "/about", licenses: "/licenses" },
  "zh-Hant": { about: "/zh-Hant/about", licenses: "/zh-Hant/licenses" },
};

export function getLicensesMetadata(locale: AboutLocale): Metadata {
  const content = getContent(locale);

  return {
    alternates: {
      canonical: paths[locale].licenses,
      languages: {
        en: paths.en.licenses,
        "x-default": paths["zh-Hans"].licenses,
        "zh-Hans": paths["zh-Hans"].licenses,
        "zh-Hant": paths["zh-Hant"].licenses,
      },
    },
    description: content.description,
    title: content.title,
  };
}

export function LicensesPage({
  fromProfile,
  locale,
}: {
  fromProfile: boolean;
  locale: AboutLocale;
}) {
  const content = getContent(locale);
  const aboutHref = `${paths[locale].about}${fromProfile ? "?from=profile" : ""}`;

  return (
    <main
      className="min-h-dvh bg-[var(--background)] pb-24 text-[var(--foreground)]"
      lang={locale}
    >
      <header className="sticky top-0 z-50 border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3">
          <Link
            aria-label={content.closeLabel}
            className="grid size-10 shrink-0 place-items-center rounded-full text-[var(--foreground)] transition hover:bg-white/50"
            href={aboutHref}
          >
            <CloseIcon />
          </Link>
          <h1 className="truncate text-lg font-bold">{content.title}</h1>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-5 py-10">
        <p className="leading-7 text-[#44474c]">{content.description}</p>

        <div className="mt-8 divide-y divide-[#c5c6cd]/40 border-y border-[#c5c6cd]/40">
          {libraries.map((library) => (
            <a
              className="flex min-w-0 items-center justify-between gap-4 py-4 transition hover:bg-white/30"
              href={library.source}
              key={library.name}
              rel="noreferrer"
              target="_blank"
            >
              <span className="min-w-0">
                <strong className="block truncate font-bold">{library.name}</strong>
                {library.version ? (
                  <span className="mt-1 block text-sm text-[#75777d]">
                    {library.version}
                  </span>
                ) : null}
              </span>
              <span className="shrink-0 text-sm font-semibold text-[#75777d]">
                {library.license}
              </span>
            </a>
          ))}
        </div>

      </section>
    </main>
  );
}

function getContent(locale: AboutLocale) {
  const name = siteConfig.name;

  if (locale === "en") {
    return {
      closeLabel: "Close open-source licenses",
      description: `${name} is built with the following open-source projects. Each project remains subject to its own license.`,
      title: "Third-party open-source software",
    };
  }

  if (locale === "zh-Hant") {
    return {
      closeLabel: "關閉開源授權頁面",
      description: `${name} 使用以下開源專案構建。各專案仍分別受其自身授權條款約束。`,
      title: "第三方開源軟體",
    };
  }

  return {
    closeLabel: "关闭开源许可页面",
    description: `${name} 使用以下开源项目构建。各项目仍分别受其自身许可条款约束。`,
    title: "第三方开源软件",
  };
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
