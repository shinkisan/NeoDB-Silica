import Image from "next/image";
import { notFound } from "next/navigation";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  normalizeNeodbItem,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { getT } from "@/i18n/server";
import {
  VersionsContentFrame,
  VersionsPageLabel,
  VersionItemLink,
  VersionsPagination,
  VersionsTopBar,
} from "./versions-chrome";
import { VersionsScrollManager } from "./versions-scroll";

type VersionsPageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
  searchParams: Promise<{
    page?: string;
  }>;
};

type BookEdition = NeodbItem & {
  author?: string[] | string | null;
  isbn?: string | null;
  orig_title?: string | null;
  pages?: number | null;
  pub_house?: string[] | string | null;
  pub_month?: string | null;
  pub_year?: string | null;
  subtitle?: string | null;
  translator?: string[] | string | null;
};

type VersionsResult =
  | {
      count: number;
      items: BookEdition[];
      pages: number;
      sourceTitle: string;
      status: "ready";
    }
  | { status: "error" };

const PAGE_SIZE = 12;

export default async function BookVersionsPage({
  params,
  searchParams,
}: VersionsPageProps) {
  const { category, uuid } = await params;
  const { page: pageParam } = await searchParams;
  const t = await getT();
  const page = Math.max(1, Number(pageParam || 1));

  if (category !== "book") {
    notFound();
  }

  const result = await fetchBookVersions(uuid, page);
  const versionsTitle =
    result.status === "ready"
      ? t("versions.titleWithBook").replace("{title}", result.sourceTitle)
      : t("versions.title");

  return (
    <>
      <VersionsTopBar title={versionsTitle} />
      <VersionsScrollManager itemUuid={uuid} />
      <div aria-hidden="true" className="h-16" />
      <main className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-24 pt-5 text-[var(--foreground)]">
        <div className="mx-auto max-w-2xl space-y-5 lg:max-w-4xl">
          <div className="px-1">
            <h1 className="text-2xl font-bold text-[var(--foreground)]">
              {versionsTitle}
            </h1>
            {result.status === "ready" ? (
              <VersionsPageLabel
                count={result.count}
                countLabel={t("versions.countLabel")}
                currentPage={page}
                pageLabel={t("versions.pageLabel")}
                pages={result.pages}
              />
            ) : (
              <p className="mt-1 text-sm leading-6 text-[#75777d]">
                {t("versions.loadError")}
              </p>
            )}
          </div>

          {result.status === "error" ? (
            <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-sm leading-6 text-[#44474c]">
              {t("versions.loadError")}
            </div>
          ) : null}

          {result.status === "ready" && result.items.length === 0 ? (
            <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-sm leading-6 text-[#44474c]">
              {t("versions.empty")}
            </div>
          ) : null}

          {result.status === "ready" && result.items.length > 0 ? (
            <>
              <VersionsContentFrame>
                <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  {result.items.map((item, index) => (
                    <VersionCard
                      index={index}
                      item={item}
                      key={item.uuid || item.id}
                      pageCountLabel={t("versions.pageCount")}
                    />
                  ))}
                </section>
              </VersionsContentFrame>
              <VersionsPagination currentPage={page} pages={result.pages} />
            </>
          ) : null}
        </div>
      </main>
    </>
  );
}

async function fetchBookVersions(
  uuid: string,
  page: number,
): Promise<VersionsResult> {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  const itemUrl = `${baseUrl}${getItemApiPath("book", uuid)}`;
  const siblingUrl = new URL(`${baseUrl}/api/book/${encodeURIComponent(uuid)}/sibling/`);
  siblingUrl.searchParams.set("page", String(page));
  siblingUrl.searchParams.set("page_size", String(PAGE_SIZE));

  try {
    const [itemResponse, siblingResponse] = await Promise.all([
      fetchWithTimeout(
        itemUrl,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 60 * 30 },
        },
        8_000,
      ),
      fetchWithTimeout(
        siblingUrl,
        {
          headers: { Accept: "application/json" },
          next: { revalidate: 60 * 30 },
        },
        8_000,
      ),
    ]);

    if (!siblingResponse.ok) {
      return { status: "error" };
    }

    const sourceItem = itemResponse.ok
      ? ((await itemResponse.json()) as BookEdition)
      : null;
    const payload = (await siblingResponse.json()) as {
      count?: number;
      data?: BookEdition[];
      pages?: number;
    };

    return {
      count: payload.count || 0,
      items: Array.isArray(payload.data)
        ? payload.data.filter((item) => item.uuid !== uuid && item.id !== uuid)
        : [],
      pages: Math.max(1, payload.pages || 1),
      sourceTitle:
        sourceItem?.display_title ||
        sourceItem?.title ||
        sourceItem?.orig_title ||
        "这本书",
      status: "ready",
    };
  } catch {
    return { status: "error" };
  }
}

function VersionCard({
  index,
  item,
  pageCountLabel,
}: {
  index: number;
  item: BookEdition;
  pageCountLabel: string;
}) {
  const baseUrl = getNeodbBaseUrl();
  const normalized = normalizeNeodbItem(item, baseUrl);
  const detailPath =
    normalized.detailPath ||
    `/item/book/${encodeURIComponent(item.uuid || item.id || "")}`;
  const publisher = toTextArray(item.pub_house)[0] || "";
  const pubDate = [item.pub_year, item.pub_month].filter(Boolean).join("-");
  const meta = getVersionMeta(item, pageCountLabel);

  return (
    <article className="overflow-hidden rounded-xl border border-white/70 bg-white/60 shadow-lg shadow-slate-900/5 transition hover:bg-white/75 active:scale-[0.99]">
      <VersionItemLink href={detailPath}>
        <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-3 p-3 sm:grid-cols-[104px_minmax(0,1fr)]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-lg bg-[#e2e2e5]">
            {normalized.coverUrl ? (
              <Image
                alt={normalized.title}
                className="h-full w-full object-cover"
                fill
                loading={index < 6 ? "eager" : "lazy"}
                quality={75}
                sizes="(max-width: 640px) 88px, 104px"
                src={normalized.coverUrl}
                unoptimized={process.env.NODE_ENV !== "production"}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-[#75777d]">
                {normalized.title}
              </div>
            )}
          </div>
          <div className="min-w-0 py-1">
            <h2 className="line-clamp-2 text-lg font-bold leading-snug text-[var(--foreground)]">
              {normalized.title}
            </h2>
            {item.subtitle ? (
              <p className="mt-1 line-clamp-1 text-sm font-semibold text-[#75777d]">
                {item.subtitle}
              </p>
            ) : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {publisher ? (
                <span className="max-w-full truncate rounded-full border border-white/70 bg-white/65 px-2.5 py-1 text-xs font-bold text-[#44474c]">
                  {publisher}
                </span>
              ) : null}
              {pubDate ? (
                <span className="rounded-full border border-white/70 bg-white/65 px-2.5 py-1 text-xs font-bold text-[#44474c]">
                  {pubDate}
                </span>
              ) : null}
            </div>
            {meta.length ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#44474c]">
                {meta.join(" / ")}
              </p>
            ) : null}
          </div>
        </div>
      </VersionItemLink>
    </article>
  );
}

function getVersionMeta(item: BookEdition, pageCountLabel: string) {
  const meta = [
    ...toTextArray(item.author),
    ...toTextArray(item.translator).map((name) => `${name} 译`),
    item.isbn ? `ISBN ${item.isbn}` : "",
    item.pages ? pageCountLabel.replace("{count}", String(item.pages)) : "",
  ];

  return meta.filter(Boolean);
}

function toTextArray(value?: string[] | string | null) {
  if (Array.isArray(value)) {
    return value.filter(Boolean);
  }

  return value ? [value] : [];
}
