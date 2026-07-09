import type { MastodonEmoji, MastodonMention } from "@/lib/mastodon-emoji";

export type TimelineView = "public" | "following" | "mine";

export type TimelineStatus = {
  account: {
    acct: string;
    avatar: string;
    displayName: string;
    emojis: MastodonEmoji[];
    id: string;
    isRemote: boolean;
    url: string;
  };
  activityStatus: string | null;
  activityType:
    | "collection"
    | "comment"
    | "mark"
    | "note"
    | "post"
    | "reblog"
    | "review";
  collection: {
    href: string;
    title: string;
  } | null;
  content: string;
  contentEmojis: MastodonEmoji[];
  contentMentions: MastodonMention[];
  createdAt: string;
  favourited: boolean;
  favouritesCount: number;
  id: string;
  interactionId: string;
  isOwn: boolean;
  item: {
    cover: string;
    href: string;
    title: string;
    type: string;
  } | null;
  media: Array<{ alt: string; previewUrl: string; url: string }>;
  rating: number | null;
  reblogAccount: {
    handle: string;
    id: string;
    isRemote: boolean;
    url: string;
  } | null;
  reblogsCount: number;
  reblogged: boolean;
  review: {
    body: string;
    href: string;
    title: string;
  } | null;
  repliesCount: number;
  sensitive: boolean;
  spoilerText: string;
  url: string;
  visibility: string;
};

export type TimelineResponse = {
  cacheScope: string;
  hasMore: boolean;
  nextMaxId: string | null;
  statuses: TimelineStatus[];
};
