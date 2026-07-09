import { cookies } from "next/headers";
import { ProfileTagsTopBar } from "./profile-tags-chrome";
import { ProfileTagsList } from "./profile-tags-list";
import { ProfileTagsPagination } from "./profile-tags-pagination";
import { ProfileTagsContentFrame } from "./profile-tags-content-frame";
import { ProfileTagsSummary } from "./profile-tags-summary";
import { getT } from "@/i18n/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export const dynamic = "force-dynamic";

type TagSchema = {
  title: string;
  uuid: string;
  visibility?: number;
};

type PagedTags = {
  count: number;
  data: TagSchema[];
  pages: number;
};

type TagItem = {
  count: number | null;
  title: string;
  uuid: string;
  visibility: number;
};

const TAG_PAGE_SIZE = 20;

export default async function ProfileTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const page = parsePage(params.page);
  const result = await fetchMyTags(page);

  return (
    <>
      <ProfileTagsTopBar
        enableTagJump={result.status !== "guest"}
        title={t("profile.myTags.title")}
      />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-tags-page
      >
        <section className="mx-auto max-w-2xl">
          {result.status === "guest" ? (
            <EmptyState text={t("profile.myTags.loginRequired")} />
          ) : null}

          {result.status === "error" ? (
            <EmptyState text={t("profile.myTags.loadError")} />
          ) : null}

          {result.status === "ok" && result.items.length === 0 ? (
            <EmptyState text={t("profile.myTags.empty")} />
          ) : null}

          {result.status === "ok" && result.items.length > 0 ? (
            <>
              <ProfileTagsSummary
                currentPage={page}
                pageLabel={t("profile.myTags.pageLabel")}
                pages={result.pages}
                totalLabel={t("profile.myTags.totalCount").replace(
                  "{count}",
                  String(result.count),
                )}
              />
              <ProfileTagsContentFrame key={page}>
                <ProfileTagsList
                  countLabel={t("profile.myTags.itemCount")}
                  items={result.items}
                  key={page}
                />
              </ProfileTagsContentFrame>
              <ProfileTagsPagination currentPage={page} pages={result.pages} />
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

async function fetchMyTags(page: number): Promise<
  | { count: number; items: TagItem[]; pages: number; status: "ok" }
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
    const url = new URL(`${session.instance}/api/me/tag/`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(TAG_PAGE_SIZE));

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

    const payload = (await response.json()) as PagedTags;
    const tags = Array.isArray(payload.data) ? payload.data : [];
    const items = await Promise.all(
      tags
        .filter((tag) => tag?.uuid && tag?.title)
        .map(async (tag) => ({
          count: await fetchTagItemCount(session, tag.uuid),
          title: tag.title,
          uuid: tag.uuid,
          visibility: typeof tag.visibility === "number" ? tag.visibility : 0,
        })),
    );
    const count = payload.count || items.length;

    return {
      count,
      items,
      pages: Math.max(1, Math.ceil(count / TAG_PAGE_SIZE)),
      status: "ok",
    };
  } catch {
    return { status: "error" };
  }
}

function parsePage(value?: string) {
  const page = Number(value || 1);

  return Number.isInteger(page) && page > 0 ? page : 1;
}

async function fetchTagItemCount(
  session: NeodbSessionCookie,
  tagUuid: string,
) {
  try {
    const url = new URL(
      `${session.instance}/api/me/tag/${encodeURIComponent(tagUuid)}/item/`,
    );
    url.searchParams.set("page", "1");
    url.searchParams.set("page_size", "1");

    const response = await fetchWithTimeout(
      url,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      5_000,
    );

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as { count?: number };

    return typeof payload.count === "number" ? payload.count : null;
  } catch {
    return null;
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
      {text}
    </div>
  );
}
