import { isRemoteAccount } from "@/lib/account-link";
import { mapMastodonEmojis, mapMastodonMentions } from "@/lib/mastodon-emoji";
import {
  parseTimelineRenderedRating,
  stripTimelineRenderedRating,
} from "@/lib/timeline-rating";
import { toFullAccountHandle } from "@/lib/account-handle";

export type MastodonAccount = {
  acct?: string;
  avatar?: string;
  display_name?: string;
  emojis?: unknown;
  id?: string;
  url?: string;
  username?: string;
};

export type RelatedEntity = {
  best?: number;
  content?: string;
  href?: string;
  image?: string;
  name?: string;
  status?: string;
  type?: string;
  value?: number;
  worst?: number;
};

export type MastodonStatus = {
  account?: MastodonAccount;
  content?: string;
  created_at?: string;
  emojis?: unknown;
  ext_neodb?: {
    relatedWith?: RelatedEntity[] | RelatedEntity | Record<string, RelatedEntity> | null;
    tag?: RelatedEntity[] | RelatedEntity | Record<string, RelatedEntity> | null;
  } | null;
  favourited?: boolean;
  favourites_count?: number;
  id?: string;
  media_attachments?: Array<{
    description?: string | null;
    preview_url?: string;
    type?: string;
    url?: string;
  }>;
  mentions?: unknown;
  reblog?: MastodonStatus | null;
  reblogs_count?: number;
  reblogged?: boolean;
  replies_count?: number;
  sensitive?: boolean;
  spoiler_text?: string;
  text?: string | null;
  url?: string | null;
  visibility?: string;
};

export function getInstanceHost(instanceUrl: string) {
  try {
    return new URL(instanceUrl).hostname;
  } catch {
    return "";
  }
}

export function mapTimelineStatuses(
  payload: MastodonStatus[],
  myId: string | null,
  instanceHost: string,
) {
  return Array.isArray(payload)
    ? payload
        .filter((status) => status.id)
        .map((status) => toTimelineStatus(status, myId, instanceHost))
    : [];
}

function toTimelineStatus(
  status: MastodonStatus,
  myId: string | null,
  instanceHost: string,
) {
  const subject = status.reblog || status;
  const reblogAccount = status.reblog?.account;
  const related = normalizeEntities(subject.ext_neodb?.relatedWith);
  const item = normalizeEntities(subject.ext_neodb?.tag).find(
    (entity) => entity.href && entity.name,
  );
  const activity = related.find((entity) => entity.type === "Status") || related[0];
  const review = related.find((entity) => entity.type === "Review");
  const collection = related.find(
    (entity) => entity.type === "Shelf" || entity.type === "Collection",
  );
  const collectionHref = collection ? toAppCollectionHref(collection.href || "") : null;
  const content = stripHtml(subject.content || subject.text || "");
  const rating = getRating(related) ?? parseTimelineRenderedRating(content);
  const isReblog = Boolean(status.reblog);

  return {
    account: {
      acct: toFullAccountHandle(
        status.account?.acct || status.account?.username,
        instanceHost,
      ),
      avatar: toAbsoluteUrl(status.account?.avatar || "", status.account?.url),
      displayName:
        status.account?.display_name || status.account?.username || status.account?.acct || "",
      emojis: mapMastodonEmojis(status.account?.emojis) || [],
      id: status.account?.id || "",
      isRemote: isRemoteAccount(status.account?.url, instanceHost),
      url: status.account?.url || "",
    },
    activityStatus: activity?.status || null,
    activityType: isReblog ? "reblog" : getActivityType(related),
    collection: collectionHref
      ? {
          href: collectionHref,
          title: collection?.name || "",
        }
      : null,
    content: rating ? stripTimelineRenderedRating(content) : content,
    contentEmojis: mapMastodonEmojis(subject.emojis) || [],
    contentMentions: mapMastodonMentions(subject.mentions, instanceHost) || [],
    createdAt: status.created_at || "",
    favourited: Boolean(subject.favourited ?? status.favourited),
    favouritesCount: subject.favourites_count ?? status.favourites_count ?? 0,
    id: status.id || "",
    interactionId: subject.id || status.id || "",
    isOwn: Boolean(myId && status.account?.id === myId),
    item: item
      ? {
          cover: toAbsoluteUrl(item.image || "", item.href),
          href: toAppItemHref(item.href || ""),
          title: item.name || "",
          type: item.type || "",
        }
      : null,
    media: (subject.media_attachments || [])
      .filter((attachment) => attachment.type === "image")
      .slice(0, 4)
      .map((attachment) => ({
        alt: attachment.description || "",
        previewUrl: attachment.preview_url || attachment.url || "",
        url: attachment.url || attachment.preview_url || "",
      })),
    rating,
    reblogAccount:
      isReblog && reblogAccount
        ? {
            handle: toShortHandle(reblogAccount),
            id: reblogAccount.id || "",
            isRemote: isRemoteAccount(reblogAccount.url, instanceHost),
            url: reblogAccount.url || "",
          }
        : null,
    reblogsCount: subject.reblogs_count ?? status.reblogs_count ?? 0,
    reblogged: Boolean(subject.reblogged ?? status.reblogged ?? isReblog),
    review:
      review?.content && review.name
        ? {
            body: review.content,
            href: review.href || "",
            title: review.name,
          }
        : null,
    repliesCount: subject.replies_count ?? status.replies_count ?? 0,
    sensitive: Boolean(subject.sensitive),
    spoilerText: subject.spoiler_text || "",
    url: status.url || "",
    visibility: status.visibility || "public",
  };
}

function getRating(entities: RelatedEntity[]) {
  const rating = entities.find((entity) => entity.type === "Rating");
  if (typeof rating?.value !== "number" || !Number.isFinite(rating.value)) {
    return null;
  }

  const best =
    typeof rating.best === "number" && Number.isFinite(rating.best)
      ? rating.best
      : 10;
  const worst =
    typeof rating.worst === "number" && Number.isFinite(rating.worst)
      ? rating.worst
      : 1;

  if (best <= worst) return null;

  const grade = 1 + (9 * (rating.value - worst)) / (best - worst);
  return Math.max(1, Math.min(10, Math.round(grade)));
}

function normalizeEntities(
  value:
    | RelatedEntity[]
    | RelatedEntity
    | Record<string, RelatedEntity>
    | null
    | undefined,
) {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    if (typeof (value as RelatedEntity).type === "string") {
      return [value as RelatedEntity];
    }

    return Object.values(value);
  }

  return [];
}

function getActivityType(entities: RelatedEntity[]) {
  if (entities.some((entity) => entity.type === "Review")) return "review";
  if (entities.some((entity) => entity.type === "Comment")) return "comment";
  if (entities.some((entity) => entity.type === "Note")) return "note";
  if (entities.some((entity) => entity.type === "Shelf" || entity.type === "Collection"))
    return "collection";
  if (entities.some((entity) => entity.type === "Status")) return "mark";
  return "post";
}

function toAppItemHref(value: string) {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const [sourceCategory, second, third] = segments;
    const categoryMap: Record<string, string> = {
      album: "music",
      book: "book",
      game: "game",
      movie: "movie",
      music: "music",
      performance: "performance",
      podcast: "podcast",
      tv: "tv",
    };
    const category = categoryMap[sourceCategory || ""];
    const uuid = sourceCategory === "tv" && second === "season" ? third : second;

    return category && uuid
      ? `/item/${category}/${encodeURIComponent(uuid)}`
      : value;
  } catch {
    return value;
  }
}

function toAppCollectionHref(value: string) {
  const match = /\/collection\/([^/?#]+)/.exec(value);
  return match ? `/collection/${encodeURIComponent(match[1])}` : null;
}

function toAbsoluteUrl(value: string, baseUrl?: string) {
  if (!value || /^https?:\/\//.test(value) || !baseUrl) {
    return value;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function toShortHandle(account: MastodonAccount) {
  const value = account.acct || account.username || account.display_name || "";
  return value ? `@${value.split("@")[0]}` : "";
}

function stripHtml(html: string) {
  const text = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return decodeHtmlEntities(text);
}

function decodeHtmlEntities(value: string) {
  let decoded = value;

  for (let index = 0; index < 8; index += 1) {
    const next = decoded
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, (_, entity: string) =>
        decodeCodePoint(entity, 16),
      )
      .replace(/&#(\d+);/g, (_, entity: string) =>
        decodeCodePoint(entity, 10),
      );

    if (next === decoded) break;
    decoded = next;
  }

  return decoded;
}

function decodeCodePoint(value: string, radix: number) {
  const codePoint = Number.parseInt(value, radix);

  try {
    return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
  } catch {
    return "";
  }
}
