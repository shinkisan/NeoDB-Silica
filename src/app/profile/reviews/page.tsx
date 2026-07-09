import { cookies } from "next/headers";
import { ProfileReviewsTopBar } from "./profile-reviews-chrome";
import {
  ProfileReviewsList,
  type ProfileReviewItem,
} from "./profile-reviews-list";
import { ProfileReviewsPagination } from "./profile-reviews-pagination";
import { getT } from "@/i18n/server";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { normalizeNeodbItem, type NeodbItem } from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export const dynamic = "force-dynamic";

type ReviewSchema = {
  body?: string;
  created_time?: string;
  item: NeodbItem;
  title?: string;
};

type PagedReviews = {
  count: number;
  data: ReviewSchema[];
  pages: number;
};

const REVIEW_PAGE_SIZE = 10;

export default async function ProfileReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getT();
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || 1));
  const result = await fetchMyReviews(t("reviewReader.fallbackTitle"), page);

  return (
    <>
      <ProfileReviewsTopBar title={t("profile.myReviews.title")} />
      <main
        className="detail-page-enter min-h-dvh bg-[var(--background)] px-5 pb-32 pt-24 text-[var(--foreground)]"
        data-profile-reviews-page
      >
        <section className="mx-auto max-w-2xl lg:max-w-4xl">
          {result.status === "guest" ? (
            <EmptyState text={t("profile.myReviews.loginRequired")} />
          ) : null}

          {result.status === "error" ? (
            <EmptyState text={t("profile.myReviews.loadError")} />
          ) : null}

          {result.status === "ok" && result.items.length === 0 ? (
            <EmptyState text={t("profile.myReviews.empty")} />
          ) : null}

          {result.status === "ok" && result.items.length > 0 ? (
            <>
              <ProfileReviewsList items={result.items} />
              <ProfileReviewsPagination currentPage={page} pages={result.pages} />
            </>
          ) : null}
        </section>
      </main>
    </>
  );
}

async function fetchMyReviews(
  fallbackReviewTitle: string,
  page: number,
): Promise<
  | { count: number; items: ProfileReviewItem[]; pages: number; status: "ok" }
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
    const url = new URL(`${session.instance}/api/me/review/`);
    url.searchParams.set("page", String(page));
    url.searchParams.set("page_size", String(REVIEW_PAGE_SIZE));

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

    const payload = (await response.json()) as PagedReviews;
    const reviews = Array.isArray(payload.data) ? payload.data : [];
    const baseUrl = session.instance;
    const items = reviews
      .filter((review) => review?.item?.uuid)
      .map((review) => {
        const item = normalizeNeodbItem(review.item, baseUrl);
        const body = review.body || "";

        return {
          body,
          createdAt: formatDateTime(review.created_time),
          detailPath: item.detailPath,
          itemCategory: item.category,
          itemTitle: item.title,
          itemUuid: review.item.uuid,
          preview: createPreview(body),
          reviewTitle: review.title || fallbackReviewTitle,
        };
      });

    return {
      count: payload.count || items.length,
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

function createPreview(value: string) {
  return value
    .replace(/!\[[^\]]*]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#>*_`~|-]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatDateTime(value?: string) {
  if (!value) {
    return "";
  }

  try {
    return new Intl.DateTimeFormat("zh-CN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}
