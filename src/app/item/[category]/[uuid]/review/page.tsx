import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { ReviewEditor } from "./review-editor";
import { ReviewLoadError } from "./review-load-error";
import {
  openCookie,
  SESSION_COOKIE,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import {
  getItemApiPath,
  getNeodbBaseUrl,
  type NeodbItem,
} from "@/lib/neodb";
import { configureServerFetchProxy } from "@/lib/server-fetch";
import { normalizeNeodbVisibility } from "@/lib/neodb-visibility";

type ReviewPageProps = {
  params: Promise<{
    category: string;
    uuid: string;
  }>;
};

type ReviewSchema = {
  body?: string;
  title?: string;
  visibility?: number | null;
};

type ReviewResult =
  | { status: "absent" }
  | { review: ReviewSchema; status: "loaded" }
  | { status: "error" };

export default async function ReviewPage({ params }: ReviewPageProps) {
  const { category, uuid } = await params;
  const item = await fetchItem(category, uuid);

  if (!item) {
    notFound();
  }

  const cookieStore = await cookies();
  const session = openCookie<NeodbSessionCookie>(
    cookieStore.get(SESSION_COOKIE)?.value,
  );
  const reviewResult: ReviewResult = session?.accessToken
    ? await fetchReview(session, item.uuid)
    : { status: "absent" };

  if (reviewResult.status === "error") {
    return (
      <ReviewLoadError
        category={item.category}
        itemUuid={item.uuid}
      />
    );
  }

  const review = reviewResult.status === "loaded" ? reviewResult.review : null;

  return (
    <ReviewEditor
      category={item.category}
      initialBody={review?.body || ""}
      initialTitle={review?.title || ""}
      initialVisibility={normalizeNeodbVisibility(review?.visibility)}
      itemUuid={item.uuid}
    />
  );
}

async function fetchItem(category: string, uuid: string) {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();

  try {
    const response = await fetch(`${baseUrl}${getItemApiPath(category, uuid)}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 60 * 30 },
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as NeodbItem;
  } catch {
    return null;
  }
}

async function fetchReview(session: NeodbSessionCookie, itemUuid: string) {
  configureServerFetchProxy();

  try {
    const response = await fetch(
      `${session.instance}/api/me/review/item/${encodeURIComponent(itemUuid)}`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
    );

    if (response.status === 404) {
      return { status: "absent" } satisfies ReviewResult;
    }

    if (!response.ok) {
      console.error("[neodb review editor] load failed", {
        itemUuid,
        status: response.status,
      });
      return { status: "error" } satisfies ReviewResult;
    }

    return {
      review: (await response.json()) as ReviewSchema,
      status: "loaded",
    } satisfies ReviewResult;
  } catch (error) {
    console.error("[neodb review editor] load failed", { error, itemUuid });
    return { status: "error" } satisfies ReviewResult;
  }
}
