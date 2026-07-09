import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import { ProfileTagsTopBar } from "../profile-tags-chrome";
import { ProfileTagsPagination } from "../profile-tags-pagination";
import { TagItemActions } from "./tag-item-actions";
import { getT } from "@/i18n/server";
import { RatingBadge } from "@/components/mark-badges";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  normalizeNeodbItem,
  type HomeItem,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export const dynamic = "force-dynamic";

type ProfileTagItemsPageProps = {
  params: Promise<{
    uuid: string;
  }>;
  searchParams: Promise<{
    page?: string;
    title?: string;
  }>;
};

type TagItemSchema = {
  item: NeodbItem;
};

type NeodbUser = {
  username?: string;
};

type PagedTagItems = {
  count: number;
  data: TagItemSchema[];
  pages: number;
};

const TAG_ITEM_PAGE_SIZE = 20;

export default async function ProfileTagItemsPage({
  params,
  searchParams,
}: ProfileTagItemsPageProps) {
  const { uuid } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(query.page || 1));
  const t = await getT();
  const result = await fetchTagItems(uuid, page);
  const tagTitle = query.title?.trim() || "";
  const title = tagTitle || t("profile.myTags.title");
  const neodbUrl =
    result.status === "ok" && tagTitle
      ? await buildTagNeodbUrl(result.baseUrl, tagTitle)
      : null;

  return (
    <>
      <ProfileTagsTopBar
        backHref="/profile/tags"
        neodbUrl={neodbUrl}
        pageSelector="[data-profile-tag-items-page]"
        showActions
        title={title}
      />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-tag-items-page
      >
        <section className="mx-auto max-w-2xl lg:max-w-4xl">
          {result.status === "guest" ? (
            <EmptyState text={t("profile.myTags.loginRequired")} />
          ) : null}

          {result.status === "error" ? (
            <EmptyState text={t("profile.myTags.itemsLoadError")} />
          ) : null}

          {result.status === "ok" && result.items.length === 0 ? (
            <EmptyState text={t("profile.myTags.itemsEmpty")} />
          ) : null}

          {result.status === "ok" && result.items.length > 0 ? (
            <div className="space-y-4">
              <div className="flex min-w-0 items-center justify-between gap-3 px-1 text-sm font-semibold text-[#75777d]">
                <span className="min-w-0 break-words">
                  {t("profile.myTags.tagItemCount").replace(
                    "{count}",
                    String(result.count),
                  )}
                </span>
                <span className="shrink-0">
                  {t("profile.myTags.pageLabel")
                    .replace("{page}", String(page))
                    .replace("{pages}", String(result.pages))}
                </span>
              </div>
              <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                {result.items.map((item, index) => (
                  <TagItemCard
                    index={index}
                    item={item}
                    key={item.id}
                    tagUuid={uuid}
                  />
                ))}
              </section>
              <ProfileTagsPagination
                basePath={`/profile/tags/${encodeURIComponent(uuid)}`}
                currentPage={page}
                pages={result.pages}
              />
            </div>
          ) : null}
        </section>
      </main>
    </>
  );
}

async function fetchTagItems(
  uuid: string,
  page: number,
): Promise<
  | { baseUrl: string; count: number; items: HomeItem[]; pages: number; status: "ok" }
  | { status: "error" | "guest" }
> {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return { status: "guest" };
  }

  configureServerFetchProxy();

  try {
    const url = new URL(
      `${session.instance}/api/me/tag/${encodeURIComponent(uuid)}/item/`,
    );
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(TAG_ITEM_PAGE_SIZE));

    const response = await fetchWithTimeout(
      url,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      8_000,
    );

    if (response.status === 401) {
      return { status: "guest" };
    }

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = (await response.json()) as PagedTagItems;
    const entries = Array.isArray(payload.data) ? payload.data : [];
    const items = entries
      .filter((entry) => entry?.item?.uuid)
      .map((entry) => normalizeNeodbItem(entry.item, session.instance));

    return {
      baseUrl: session.instance,
      count: payload.count || items.length,
      items,
      pages: Math.max(1, payload.pages || 1),
      status: "ok",
    };
  } catch {
    return { status: "error" };
  }
}

async function buildTagNeodbUrl(baseUrl: string, title: string) {
  if (!title) {
    return null;
  }

  try {
    const user = await fetchCurrentUser();

    if (!user?.username) {
      return null;
    }

    const url = new URL(
      `/users/${encodeURIComponent(user.username)}/tags/${encodeURIComponent(title)}/`,
      baseUrl,
    );

    return url.toString();
  } catch {
    return null;
  }
}

async function fetchCurrentUser() {
  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );

  if (!session?.accessToken) {
    return null;
  }

  configureServerFetchProxy();

  const response = await fetchWithTimeout(
    `${session.instance}/api/me`,
    {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
      },
    },
    6_000,
  );

  if (!response.ok) {
    return null;
  }

  return (await response.json()) as NeodbUser;
}

function TagItemCard({
  index,
  item,
  tagUuid,
}: {
  index: number;
  item: HomeItem;
  tagUuid: string;
}) {
  const href = `${item.detailPath}?fromCategory=tag`;

  return (
    <article className="relative rounded-2xl border border-white/70 bg-white/60 p-3 shadow-lg shadow-slate-900/5 transition hover:bg-white/75 active:scale-[0.99]">
      <TagItemActions itemTitle={item.title} itemUuid={item.id} tagUuid={tagUuid} />
      <Link className="block" href={href}>
        <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-4 pr-8 sm:grid-cols-[7rem_minmax(0,1fr)]">
          <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#e2e2e5]">
            {item.coverUrl ? (
              <Image
                alt={item.title}
                className="h-full w-full object-cover"
                fill
                loading={index < 8 ? "eager" : "lazy"}
                quality={75}
                sizes="(max-width: 640px) 96px, 112px"
                src={item.coverUrl}
                unoptimized={process.env.NODE_ENV !== "production"}
              />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-xs font-semibold text-[#75777d]">
                {item.title}
              </div>
            )}
          </div>
          <div className="min-w-0 py-1">
            <h2 className="line-clamp-2 text-lg font-bold leading-snug text-[var(--foreground)]">
              {item.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[#c5c6cd]/70 bg-white/70 px-2.5 py-1 text-xs font-bold text-[#44474c]">
                {item.categoryLabel}
              </span>
              <RatingBadge value={item.rating} />
            </div>
            {item.creator ? (
              <p className="mt-2 truncate text-sm font-semibold text-[#75777d]">
                {item.creator}
              </p>
            ) : null}
          </div>
        </div>
      </Link>
    </article>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
      {text}
    </div>
  );
}
