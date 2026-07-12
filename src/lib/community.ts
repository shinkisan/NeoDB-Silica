import { type NeodbSessionCookie } from "@/lib/neodb-auth";
import { getNeodbBaseUrl } from "@/lib/neodb";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import {
  mapMastodonEmojis,
  mapMastodonMentions,
  type MastodonEmoji,
  type MastodonMention,
} from "@/lib/mastodon-emoji";
import { toFullAccountHandle } from "@/lib/account-handle";
import type { Locale } from "@/i18n/config";

const COMMUNITY_AUTHENTICATED_REVALIDATE_SECONDS = 15;

export type CommunityPost = {
  id: string;
  created_at: string;
  account: {
    acct?: string;
    display_name: string;
    emojis?: unknown;
    id?: string;
    username: string;
    avatar: string;
  };
  content: string;
  emojis?: unknown;
  mentions?: unknown;
  text?: string;
  favorited?: boolean;
  favourited?: boolean;
  favourites_count: number;
  reblogged?: boolean;
  reblogs_count?: number;
  replies_count: number;
  ext_neodb?: {
    relatedWith?: RelatedEntity[] | RelatedEntity | Record<string, RelatedEntity> | null;
  } | null;
};

type RelatedEntity = {
  api_url?: string;
  body?: string;
  href?: string;
  id?: string;
  type?: string;
  html_content?: string;
  name?: string;
  status?: string;
  content?: string;
  title?: string;
  url?: string;
  uuid?: string;
  value?: number;
};

type CommunityResponse = {
  data: CommunityPost[];
  pages?: number;
  count?: number;
};

export type CurrentUserResponse = {
  avatar?: string;
  display_name?: string;
  external_accounts?: Array<{ acct?: string; handle?: string }>;
  external_acct?: string | null;
  username?: string;
};

type OwnMarkResponse = {
  comment_text?: string | null;
  created_time?: string | null;
  post_id?: number | string | null;
  rating_grade?: number | null;
  shelf_type?: string | null;
  visibility?: number | null;
};

type OwnReviewResponse = {
  api_url?: string | null;
  body?: string | null;
  created_time?: string | null;
  html_content?: string | null;
  post_id?: number | string | null;
  title?: string | null;
  url?: string | null;
  visibility?: number | null;
};

export type CommunityCommentProps = {
  avatar: string;
  authorAcct?: string;
  authorId?: string;
  authorUsername?: string;
  category: string;
  comment: string;
  contentEmojis?: MastodonEmoji[];
  contentMentions?: MastodonMention[];
  createdAt?: string;
  disabled: boolean;
  favourited: boolean;
  favouritesCount: number;
  isOwn: boolean;
  reblogged: boolean;
  reblogsCount: number;
  repliesCount: number;
  itemUuid: string;
  name: string;
  nameEmojis?: MastodonEmoji[];
  postId: string;
  rating: number | null;
  review: {
    apiUrl?: string | null;
    body?: string | null;
    title: string;
    url?: string | null;
    uuid?: string | null;
  } | null;
  status: string | null;
  time: string;
  visibility?: number;
};

export type CommunityPage = {
  count: number;
  hasMore: boolean;
  items: CommunityCommentProps[];
  page: number;
};

export type CommunityOwnEntries = {
  comment: CommunityCommentProps | null;
  review: CommunityCommentProps | null;
};

type MappingContext = {
  category: string;
  instanceHost: string;
  isAuthenticated: boolean;
  itemUuid: string;
  locale: Locale;
  ownAccounts: Set<string>;
};

export async function getCommunityCommentPage({
  category,
  itemUuid,
  locale,
  page = 1,
  session,
  type,
}: {
  category: string;
  itemUuid: string;
  locale: Locale;
  page?: number;
  session: NeodbSessionCookie | null;
  type: "comment" | "review";
}): Promise<CommunityPage> {
  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  const headers: Record<string, string> = { Accept: "application/json" };

  if (session?.accessToken) {
    headers.Authorization = `${session.tokenType || "Bearer"} ${session.accessToken}`;
  }

  const [{ count, hasMore, posts: rawPosts }, currentUser] = await Promise.all([
    fetchCommunityPostPage({ baseUrl, headers, itemUuid, page, session, type }),
    fetchCurrentUser(session),
  ]);

  const posts = session?.accessToken
    ? await hydrateFavouriteStates(rawPosts, session)
    : rawPosts;
  const ctx = buildMappingContext({ category, itemUuid, locale, session, currentUser });
  const items = posts
    .map((post) => mapPostToCommentProps(post, ctx))
    .filter((entry) => (type === "comment" ? Boolean(entry.comment) : Boolean(entry.review)));

  return { count, hasMore, items, page };
}

export async function getCommunityOwnEntries({
  category,
  itemUuid,
  locale,
  session,
}: {
  category: string;
  itemUuid: string;
  locale: Locale;
  session: NeodbSessionCookie | null;
}): Promise<CommunityOwnEntries> {
  if (!session?.accessToken) {
    return { comment: null, review: null };
  }

  configureServerFetchProxy();

  const [mark, review, currentUser] = await Promise.all([
    fetchOwnMark(itemUuid, session),
    fetchOwnReview(itemUuid, session),
    fetchCurrentUser(session),
  ]);

  const ctx = buildMappingContext({ category, itemUuid, locale, session, currentUser });

  const [comment, reviewEntry] = await Promise.all([
    buildOwnCommentEntry(mark, session, ctx, currentUser),
    buildOwnReviewEntry(review, session, ctx, currentUser),
  ]);

  return { comment, review: reviewEntry };
}

function buildMappingContext({
  category,
  itemUuid,
  locale,
  session,
  currentUser,
}: {
  category: string;
  itemUuid: string;
  locale: Locale;
  session: NeodbSessionCookie | null;
  currentUser: CurrentUserResponse | null;
}): MappingContext {
  return {
    category,
    instanceHost: getInstanceHost(session?.instance || getNeodbBaseUrl()),
    isAuthenticated: Boolean(session?.accessToken),
    itemUuid,
    locale,
    ownAccounts: buildOwnAccounts(currentUser),
  };
}

export function buildOwnAccounts(currentUser: CurrentUserResponse | null) {
  return new Set<string>(
    currentUser
      ? [
          currentUser.username || "",
          currentUser.external_acct || "",
          ...(currentUser.external_accounts || []).flatMap((account) => [
            account.acct || "",
            account.handle || "",
          ]),
        ].filter(Boolean)
      : [],
  );
}

function mapPostToCommentProps(
  post: CommunityPost,
  ctx: MappingContext,
): CommunityCommentProps {
  return {
    avatar: post.account.avatar,
    authorAcct: toFullAccountHandle(
      post.account.acct || post.account.username,
      ctx.instanceHost,
    ),
    authorId: post.account.id,
    authorUsername: post.account.username,
    category: ctx.category,
    comment: getPostComment(post),
    contentEmojis: mapMastodonEmojis(post.emojis),
    contentMentions: mapMastodonMentions(post.mentions, ctx.instanceHost),
    createdAt: post.created_at,
    disabled: !ctx.isAuthenticated,
    favourited: Boolean(post.favourited ?? post.favorited),
    favouritesCount: post.favourites_count,
    isOwn: isOwnPost(post, ctx.ownAccounts),
    reblogged: Boolean(post.reblogged),
    reblogsCount: post.reblogs_count ?? 0,
    repliesCount: post.replies_count,
    itemUuid: ctx.itemUuid,
    name: post.account.display_name || post.account.username,
    nameEmojis: mapMastodonEmojis(post.account.emojis),
    postId: post.id,
    rating: getPostRating(post),
    review: getPostReview(post),
    status: getPostStatus(post),
    time: formatTime(post.created_at, ctx.locale),
  };
}

function getInstanceHost(instanceUrl: string) {
  try {
    return new URL(instanceUrl).hostname;
  } catch {
    return "";
  }
}

async function fetchCommunityPostPage({
  baseUrl,
  headers,
  itemUuid,
  page,
  session,
  type,
}: {
  baseUrl: string;
  headers: Record<string, string>;
  itemUuid: string;
  page: number;
  session: NeodbSessionCookie | null;
  type: "comment" | "review";
}): Promise<{ count: number; hasMore: boolean; posts: CommunityPost[] }> {
  const params = new URLSearchParams({ page: String(page), type });
  const fetchOptions = session?.accessToken
    ? {
        cache: "no-store" as const,
        headers,
      }
    : {
        headers,
        next: {
          revalidate: 60 * 10,
        },
      };

  try {
    const response = await fetchWithTimeout(
      `${baseUrl}/api/item/${itemUuid}/posts/?${params.toString()}`,
      fetchOptions,
      8_000,
    );

    if (!response.ok) {
      return { count: 0, hasMore: false, posts: [] };
    }

    const payload = parseNeodbJsonSafely<CommunityResponse>(
      await response.text(),
    );
    const pages = payload.pages || 1;

    return {
      count: payload.count || 0,
      hasMore: page < pages,
      posts: payload.data || [],
    };
  } catch {
    return { count: 0, hasMore: false, posts: [] };
  }
}

async function fetchStatusById(
  postId: string | number,
  session: NeodbSessionCookie,
) {
  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/v1/statuses/${encodeURIComponent(String(postId))}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
        next: { revalidate: COMMUNITY_AUTHENTICATED_REVALIDATE_SECONDS },
      },
      4_000,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CommunityPost;
  } catch {
    return null;
  }
}

async function hydrateFavouriteStates(
  posts: CommunityPost[],
  session: NeodbSessionCookie,
) {
  return await Promise.all(
    posts.map(async (post) => {
      const status = await fetchStatusById(post.id, session);

      if (!status) {
        return post;
      }

      return {
        ...post,
        favorited: status.favorited ?? post.favorited,
        favourited: status.favourited ?? post.favourited,
        favourites_count:
          typeof status.favourites_count === "number"
            ? status.favourites_count
            : post.favourites_count,
        reblogged: status.reblogged ?? post.reblogged,
        reblogs_count:
          typeof status.reblogs_count === "number"
            ? status.reblogs_count
            : post.reblogs_count,
      };
    }),
  );
}

export async function fetchCurrentUser(session: NeodbSessionCookie | null) {
  if (!session?.accessToken) {
    return null;
  }

  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me`,
      {
        cache: "no-store",
        headers: {
          Accept: "application/json",
          Authorization: `${session.tokenType || "Bearer"} ${session.accessToken}`,
        },
      },
      4_000,
    );

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as CurrentUserResponse;
  } catch {
    return null;
  }
}

// NeoDB's own API surface (unlike its Mastodon-compatible /api/v1/* surface,
// which correctly quotes large IDs) returns entity ids as bare JSON numbers —
// /api/me/shelf and /api/me/review as `post_id`, /api/item/{uuid}/posts/ as
// `id` (both the post's own id and, nested, its author's account id). Those
// routinely exceed Number.MAX_SAFE_INTEGER, so plain JSON.parse silently
// rounds them to a different number — every later lookup by that corrupted
// id then fails. Quote the known id-bearing fields before parsing so they
// round-trip as strings instead.
function parseNeodbJsonSafely<T>(text: string): T {
  return JSON.parse(
    text.replace(/"(id|post_id)":\s*(-?\d+)/g, '"$1":"$2"'),
  ) as T;
}

async function fetchOwnMark(itemUuid: string, session: NeodbSessionCookie) {
  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/shelf/item/${encodeURIComponent(itemUuid)}`,
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
      return null;
    }

    return parseNeodbJsonSafely<OwnMarkResponse>(await response.text());
  } catch {
    return null;
  }
}

async function fetchOwnReview(itemUuid: string, session: NeodbSessionCookie) {
  try {
    const response = await fetchWithTimeout(
      `${session.instance}/api/me/review/item/${encodeURIComponent(itemUuid)}`,
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
      return null;
    }

    return parseNeodbJsonSafely<OwnReviewResponse>(await response.text());
  } catch {
    return null;
  }
}

async function buildOwnCommentEntry(
  mark: OwnMarkResponse | null,
  session: NeodbSessionCookie,
  ctx: MappingContext,
  currentUser: CurrentUserResponse | null,
): Promise<CommunityCommentProps | null> {
  const commentText = mark?.comment_text?.trim();

  if (!mark || !commentText) {
    return null;
  }

  const rating =
    typeof mark.rating_grade === "number" && mark.rating_grade > 0
      ? mark.rating_grade
      : null;
  const visibility = typeof mark.visibility === "number" ? mark.visibility : 0;
  const status =
    mark.post_id != null ? await fetchStatusById(mark.post_id, session) : null;

  if (status) {
    const base = mapPostToCommentProps(status, ctx);

    return {
      ...base,
      comment: commentText,
      isOwn: true,
      rating: rating ?? base.rating,
      status: mark.shelf_type || base.status,
      visibility,
    };
  }

  return buildFallbackOwnEntry({
    comment: commentText,
    createdAt: mark.created_time || undefined,
    currentUser,
    ctx,
    postId: `local-${ctx.itemUuid}`,
    rating,
    status: mark.shelf_type || null,
    visibility,
  });
}

async function buildOwnReviewEntry(
  review: OwnReviewResponse | null,
  session: NeodbSessionCookie,
  ctx: MappingContext,
  currentUser: CurrentUserResponse | null,
): Promise<CommunityCommentProps | null> {
  if (!review) {
    return null;
  }

  const visibility = typeof review.visibility === "number" ? review.visibility : 0;
  const reviewData = {
    apiUrl: review.api_url || null,
    body: (review.body || stripHtml(review.html_content || "")).trim() || null,
    title: (review.title || "").trim(),
    url: review.url || null,
    uuid: extractReviewUuid(review.api_url || review.url || ""),
  };
  const status =
    review.post_id != null ? await fetchStatusById(review.post_id, session) : null;

  if (status) {
    const base = mapPostToCommentProps(status, ctx);

    return {
      ...base,
      isOwn: true,
      review: reviewData,
      visibility,
    };
  }

  return buildFallbackOwnEntry({
    createdAt: review.created_time || undefined,
    currentUser,
    ctx,
    postId: `local-review-${ctx.itemUuid}`,
    review: reviewData,
    visibility,
  });
}

function buildFallbackOwnEntry({
  comment = "",
  createdAt,
  currentUser,
  ctx,
  postId,
  rating = null,
  review = null,
  status = null,
  visibility = 0,
}: {
  comment?: string;
  createdAt?: string;
  currentUser: CurrentUserResponse | null;
  ctx: MappingContext;
  postId: string;
  rating?: number | null;
  review?: CommunityCommentProps["review"];
  status?: string | null;
  visibility?: number;
}): CommunityCommentProps {
  return {
    avatar: currentUser?.avatar || "",
    category: ctx.category,
    comment,
    createdAt,
    disabled: false,
    favourited: false,
    favouritesCount: 0,
    isOwn: true,
    itemUuid: ctx.itemUuid,
    name: currentUser?.display_name || currentUser?.username || "",
    postId,
    rating,
    reblogged: false,
    reblogsCount: 0,
    repliesCount: 0,
    review,
    status,
    time: "",
    visibility,
  };
}

function isOwnPost(post: CommunityPost, ownAccounts: Set<string>) {
  return (
    ownAccounts.has(post.account.username) ||
    Boolean(post.account.acct && ownAccounts.has(post.account.acct))
  );
}

function getPostStatus(post: CommunityPost) {
  const structuredStatus = getRelatedEntities(post).find(
    (entry) => entry.type === "Status",
  )?.status;

  if (structuredStatus) {
    return structuredStatus;
  }

  const text = stripHtml(post.content || post.text || "");
  const parsedStatus = parseStatusFromText(text);

  if (parsedStatus) {
    return parsedStatus;
  }

  return hasPostReview(post) ? "complete" : null;
}

function getPostRating(post: CommunityPost) {
  const structuredRating = getRelatedEntities(post).find(
    (entry) => entry.type === "Rating",
  )?.value;

  if (typeof structuredRating === "number") {
    return structuredRating;
  }

  return parseMoonRating(stripHtml(post.content || post.text || ""));
}

function getPostComment(post: CommunityPost) {
  const structuredComment = getRelatedEntities(post).find(
    (entry) => entry.type === "Comment",
  )?.content;

  if (structuredComment) {
    return structuredComment.trim();
  }

  if (hasPostReview(post)) {
    return "";
  }

  return stripPostPrefix(stripHtml(post.content));
}

function hasPostReview(post: CommunityPost) {
  return Boolean(
    getRelatedEntities(post).some(
      (entry) => entry.type === "Review" || entry.type === "Note",
    ),
  );
}

function parseStatusFromText(text: string) {
  if (/想读|想看|想听|想玩/.test(text)) {
    return "wishlist";
  }

  if (/在读|在看|在听|在玩/.test(text)) {
    return "progress";
  }

  if (/读过|看过|听过|玩过/.test(text)) {
    return "complete";
  }

  if (/搁置/.test(text)) {
    return "dropped";
  }

  return null;
}

function parseMoonRating(text: string) {
  const match = /[🌕🌖🌗🌘🌑]{2,5}/u.exec(text);

  if (!match) {
    return null;
  }

  const value = Array.from(match[0]).reduce((sum, moon) => {
    if (moon === "🌕") {
      return sum + 2;
    }

    if (moon === "🌑") {
      return sum;
    }

    return sum + 1;
  }, 0);

  return value > 0 ? value : null;
}

function getPostReview(post: CommunityPost) {
  const review = getRelatedEntities(post).find(
    (entry) => entry.type === "Review" || entry.type === "Note",
  );

  const title = review?.title || review?.name;

  if (!review || !title) {
    return null;
  }

  const body =
    review.body ||
    review.content ||
    stripHtml(review.html_content || "");

  return {
    apiUrl: review.api_url || null,
    body: body.trim() || null,
    title: title.trim(),
    url: review.url || review.href || null,
    uuid:
      review.uuid ||
      extractReviewUuid(
        review.api_url || review.url || review.href || review.id || "",
      ),
  };
}

function getRelatedEntities(post: CommunityPost) {
  const relatedWith = post.ext_neodb?.relatedWith;

  if (Array.isArray(relatedWith)) {
    return relatedWith;
  }

  if (relatedWith && typeof relatedWith === "object") {
    // ActivityStreams collapses a single related entity to a bare object
    // instead of a one-element array; only fall back to treating it as a
    // map of entities when it doesn't look like an entity itself.
    if (typeof (relatedWith as RelatedEntity).type === "string") {
      return [relatedWith as RelatedEntity];
    }

    return Object.values(relatedWith).filter(
      (entry): entry is RelatedEntity =>
        Boolean(entry && typeof entry === "object"),
    );
  }

  return [];
}

function extractReviewUuid(value: string) {
  const match = /\/review\/([^/?#]+)/.exec(value);
  return match?.[1] || null;
}

function stripPostPrefix(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length <= 1) {
    return text;
  }

  return lines.slice(1).join("\n");
}

function stripHtml(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function formatTime(value: string, locale: Locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
