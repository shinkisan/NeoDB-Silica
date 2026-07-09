import { cookies } from "next/headers";
import { ProfileCollectionsTopBar } from "./profile-collections-chrome";
import { ProfileCollectionsGrid } from "./profile-collections-grid";
import { ProfileCollectionsPagination } from "./profile-collections-pagination";
import { getT } from "@/i18n/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  normalizeNeodbCollection,
  type HomeItem,
  type NeodbCollection,
} from "@/lib/neodb";
import { applyCollectionFallbackCover } from "@/lib/collection-fallback-cover";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export const dynamic = "force-dynamic";

type PagedCollections = {
  count: number;
  data: NeodbCollection[];
  pages: number;
};

const COLLECTION_PAGE_SIZE = 18;

export default async function ProfileCollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const result = await fetchMyCollections(page);

  return (
    <>
      <ProfileCollectionsTopBar title={t("collection.title")} />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-collections-page
      >
        <section className="mx-auto max-w-2xl">
          {result.status === "guest" ? (
            <EmptyState text={t("profile.myCollections.loginRequired")} />
          ) : null}

          {result.status === "error" ? (
            <EmptyState text={t("profile.myCollections.loadError")} />
          ) : null}

          {result.status === "ok" && result.items.length === 0 ? (
            <EmptyState text={t("profile.myCollections.empty")} />
          ) : null}

          {result.status === "ok" && result.items.length > 0 ? (
            <>
              <ProfileCollectionsGrid items={result.items} />
              <ProfileCollectionsPagination
                currentPage={page}
                pages={result.pages}
              />
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

async function fetchMyCollections(page: number): Promise<
  | { count: number; items: HomeItem[]; pages: number; status: "ok" }
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
    const url = new URL(`${session.instance}/api/me/collection/`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(COLLECTION_PAGE_SIZE));

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

    if (!response.ok) {
      return { status: "error" };
    }

    const payload = (await response.json()) as PagedCollections;
    const collections = Array.isArray(payload.data) ? payload.data : [];

    const items = await Promise.all(
      collections
        .filter((collection) => collection?.uuid && collection?.url)
        .map((collection) =>
          applyCollectionFallbackCover(
            normalizeNeodbCollection(collection, session.instance),
            {
              baseUrl: session.instance,
              fetchInit: {
                cache: "no-store",
                headers: {
                  Accept: "application/json",
                  Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
                },
              },
            },
          ),
        ),
    );

    return {
      count: payload.count || collections.length,
      items,
      pages: Math.max(1, payload.pages || 1),
      status: "ok",
    };
  } catch {
    return { status: "error" };
  }
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e2e5] bg-white/70 p-6 text-center text-sm font-semibold text-[#44474c]">
      {text}
    </div>
  );
}
