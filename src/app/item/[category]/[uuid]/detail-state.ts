export const DETAIL_MARK_EVENT = "bielu:item-mark";
export const DETAIL_MARK_CACHE_PREFIX = "bielu:v1:item-mark-cache:";

export const DETAIL_EDITOR_RETURN_PREFIX = "bielu:v1:detail-editor-return:";
export const DETAIL_RESTORE_PREFIX = "bielu:v1:detail-restore:";
export const DETAIL_SCROLL_PREFIX = "bielu:v1:detail-scroll:";

export const DETAIL_COMMENTS_REFRESH_EVENT = "bielu:detail-comments-refresh";
export const DETAIL_COMMENT_LOCAL_EVENT = "bielu:detail-comment-local";
export const DETAIL_OPEN_SHORT_REVIEW_EVENT = "bielu:detail-open-short-review";

export const DETAIL_COMMENTS_CACHE_PREFIX = "bielu:v5:detail-comments:";
export const DETAIL_COMMUNITY_TAB_PREFIX = "bielu:v1:detail-community-tab:";
export const DETAIL_COMMENTS_REUSE_PREFIX = "bielu:v1:detail-comments-reuse:";
export const DETAIL_REVIEW_LOCAL_PREFIX = "bielu:v1:detail-review-local:";

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
