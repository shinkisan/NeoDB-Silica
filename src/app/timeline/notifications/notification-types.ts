import type { MastodonEmoji } from "@/lib/mastodon-emoji";
import type { TimelineStatus } from "../timeline-types";

export type NotificationActor = {
  acct: string;
  avatar: string;
  displayName: string;
  emojis: MastodonEmoji[];
  id: string;
  isRemote: boolean;
  url: string;
};

export type TimelineNotification = {
  account: NotificationActor;
  createdAt: string;
  id: string;
  status: TimelineStatus | null;
  type: "favourite" | "follow" | "mention" | "reblog" | "unknown";
};

export type NotificationsResponse = {
  hasMore: boolean;
  nextMaxId: string | null;
  notifications: TimelineNotification[];
};
