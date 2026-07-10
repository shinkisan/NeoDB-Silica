import { STORAGE_PREFIX } from "@/lib/runtime-ids";
export const DETAIL_MARK_EVENT = "app:item-mark";
export const DETAIL_MARK_CACHE_PREFIX = `${STORAGE_PREFIX}v1:item-mark-cache:`;

export const DETAIL_EDITOR_RETURN_PREFIX = `${STORAGE_PREFIX}v1:detail-editor-return:`;
export const DETAIL_RESTORE_PREFIX = `${STORAGE_PREFIX}v1:detail-restore:`;
export const DETAIL_SCROLL_PREFIX = `${STORAGE_PREFIX}v1:detail-scroll:`;

export const DETAIL_COMMENTS_REFRESH_EVENT = "app:detail-comments-refresh";
export const DETAIL_COMMENT_LOCAL_EVENT = "app:detail-comment-local";
export const DETAIL_OPEN_SHORT_REVIEW_EVENT = "app:detail-open-short-review";

export const DETAIL_COMMENTS_CACHE_PREFIX = `${STORAGE_PREFIX}v5:detail-comments:`;
export const DETAIL_COMMUNITY_TAB_PREFIX = `${STORAGE_PREFIX}v1:detail-community-tab:`;
export const DETAIL_COMMENTS_REUSE_PREFIX = `${STORAGE_PREFIX}v1:detail-comments-reuse:`;
export const DETAIL_REVIEW_LOCAL_PREFIX = `${STORAGE_PREFIX}v1:detail-review-local:`;

export type DetailCommentLocalEvent = {
  commentText: string;
  itemUuid: string;
  ratingGrade: number;
  shelfType: string | null;
  tags?: string[];
  visibility: number;
};

export type DetailReviewLocalSnapshot = {
  body: string;
  itemUuid: string;
  title: string;
  visibility: number;
};
