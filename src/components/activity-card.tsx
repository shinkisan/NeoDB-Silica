"use client";

import Link from "next/link";
import { memo, useState } from "react";
import { useT } from "@/components/use-t";
import { useFeatureFlags } from "@/components/feature-flags";
import { RatingBadge, StatusBadge } from "@/components/mark-badges";
import { ReviewReaderTrigger } from "@/components/review-reader-trigger";
import { SpoilerText } from "@/components/spoiler-text";
import { BoostButton } from "@/components/boost-button";
import { CommunityTime } from "@/app/item/[category]/[uuid]/community-time";
import { CommentFavouriteButton } from "@/app/item/[category]/[uuid]/comment-favourite-button";
import { CommentReplies } from "@/app/item/[category]/[uuid]/comment-replies";
import { useCommentTranslation } from "@/app/item/[category]/[uuid]/comment-translation";
import { requestDetailScrollTopForHref } from "@/lib/detail-scroll";
import { pushNavigationFrame } from "@/components/navigation-history";
import { ProfileLink } from "@/components/profile-link";
import { renderTextWithEmoji } from "@/lib/mastodon-emoji";
import { showToast } from "@/components/app-toast";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  parseTimelineRenderedRating,
  stripTimelineRenderedRating,
} from "@/lib/timeline-rating";
import { formatAccountHandle } from "@/lib/account-handle";
import type { TimelineStatus } from "@/app/timeline/timeline-types";

export type UpdateActivityStatus = (
  postId: string,
  update: (status: TimelineStatus) => TimelineStatus,
) => void;

export function ActivityCardList({
  hideAuthor,
  onDelete,
  onNavigate,
  statuses,
  updateStatus,
}: {
  hideAuthor?: boolean;
  onDelete?: (postId: string) => void;
  onNavigate?: (href: string) => void;
  statuses: TimelineStatus[];
  updateStatus: UpdateActivityStatus;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/60 bg-white/70 shadow-lg shadow-slate-900/5">
      {statuses.map((status) => (
        <ActivityCard
          hideAuthor={hideAuthor}
          key={status.id}
          onDelete={onDelete}
          onNavigate={onNavigate}
          status={status}
          updateStatus={updateStatus}
        />
      ))}
    </div>
  );
}

export const ActivityCard = memo(function ActivityCard({
  hideAuthor,
  onDelete,
  onNavigate,
  status,
  updateStatus,
}: {
  hideAuthor?: boolean;
  onDelete?: (postId: string) => void;
  onNavigate?: (href: string) => void;
  status: TimelineStatus;
  updateStatus: UpdateActivityStatus;
}) {
  const t = useT();
  const { translate: translateEnabled } = useFeatureFlags();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [isSensitiveRevealed, setIsSensitiveRevealed] = useState(false);
  const rating = status.rating ?? parseTimelineRenderedRating(status.content);
  const content = rating
    ? stripTimelineRenderedRating(status.content)
    : status.content;
  const displayContent = status.review
    ? getReviewActivitySummary(content, status.review.title)
    : content;
  const translation = useCommentTranslation(displayContent);
  const category = getActivityItemCategory(status.item?.href);
  const activityLabel = t(`timeline.activity.${status.activityType}`);
  // NeoDB sets spoiler_text unconditionally on review posts as a generic
  // "a review of {title}" AP teaser, not a real spoiler warning - the actual
  // review body never appears inline anyway (ReviewReaderTrigger owns that),
  // so only comment-style posts should be gated by it.
  const hasContentWarning = status.sensitive || (!status.review && status.spoilerText);
  const isContentVisible = !hasContentWarning || isSensitiveRevealed;
  const reblogAccountLabel = status.reblogAccount
    ? t("timeline.activity.reblogWithAccount").replace("{account}", "")
    : "";
  const accountHandle = formatAccountHandle(status.account.acct);

  const handleReblogChange = (next: { count: number; reblogged: boolean }) => {
    // Undoing my own reblog dissolves the reblog activity itself, so drop the
    // whole entry optimistically (front-end + cache only, no delete request)
    // instead of leaving a stale "reblogged" card behind.
    if (!next.reblogged && status.isOwn && status.reblogAccount) {
      onDelete?.(status.id);
      return;
    }
    updateStatus(status.id, (current) => ({
      ...current,
      reblogged: next.reblogged,
      reblogsCount: next.count,
    }));
  };

  const avatarContent = status.account.avatar && !avatarFailed ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      alt=""
      className="size-11 shrink-0 rounded-full border-2 border-white bg-[#dde3eb] object-cover"
      loading="lazy"
      onError={() => setAvatarFailed(true)}
      src={status.account.avatar}
    />
  ) : (
    <div className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-white bg-[#dde3eb] text-sm font-bold text-[#333e50]">
      {status.account.displayName.slice(0, 1)}
    </div>
  );

  return (
    <article
      className={`flex min-w-0 border-b border-[#c5c6cd]/30 p-4 last:border-0 sm:p-5 ${hideAuthor ? "" : "gap-3 sm:gap-4"}`}
    >
      {hideAuthor ? null : (
        <ProfileLink
          accountId={status.account.id}
          isRemote={status.account.isRemote}
          onNavigate={onNavigate}
          url={status.account.url}
        >
          {avatarContent}
        </ProfileLink>
      )}

      <div className="min-w-0 flex-1">
        {hideAuthor ? null : (
          <div className="min-w-0">
            <ProfileLink
              accountId={status.account.id}
              className="block truncate text-sm font-bold text-[var(--foreground)] hover:underline"
              isRemote={status.account.isRemote}
              onNavigate={onNavigate}
              url={status.account.url}
            >
              {renderTextWithEmoji(status.account.displayName, status.account.emojis)}
            </ProfileLink>
            {accountHandle ? (
              <div className="mt-0.5 truncate text-xs font-semibold leading-4 text-[#75777d]">
                {accountHandle}
              </div>
            ) : null}
          </div>
        )}

        <div className={`flex min-w-0 flex-wrap items-center gap-2 ${hideAuthor ? "" : "mt-2"}`}>
          {status.reblogAccount ? (
            <span className="text-xs font-semibold text-[#75777d]">
              {reblogAccountLabel}
              <ProfileLink
                accountId={status.reblogAccount.id}
                className="text-[#5f6269] hover:text-[var(--foreground)] hover:underline"
                isRemote={status.reblogAccount.isRemote}
                onNavigate={onNavigate}
                url={status.reblogAccount.url}
              >
                {status.reblogAccount.handle}
              </ProfileLink>
              {t("timeline.activity.reblogWithAccountSuffix")}
            </span>
          ) : (
            <span className="text-xs font-semibold text-[#75777d]">{activityLabel}</span>
          )}
          {status.activityStatus && category ? (
            <StatusBadge category={category} status={status.activityStatus} />
          ) : null}
          {rating ? <RatingBadge value={rating} /> : null}
          <ActivityVisibilityIcon visibility={status.visibility} />
        </div>

        {status.spoilerText && !status.review ? (
          <button
            className="mt-3 flex w-full items-center justify-between gap-3 rounded-lg border border-white/60 bg-white/45 px-3 py-2 text-left text-sm font-semibold text-[#44474c] transition hover:bg-white/55"
            onClick={() => setIsSensitiveRevealed((current) => !current)}
            type="button"
          >
            <span>{renderTextWithEmoji(status.spoilerText, status.contentEmojis)}</span>
            <span className="shrink-0 text-xs text-[#75777d]">
              {isSensitiveRevealed
                ? t("timeline.sensitive.hide")
                : t("timeline.sensitive.show")}
            </span>
          </button>
        ) : null}

        {isContentVisible && displayContent ? (
          status.review ? (
            <ReviewReaderTrigger
              body={status.review.body}
              className="group mt-3 block w-full cursor-pointer text-left"
              externalUrl={status.review.href || null}
              favourited={status.favourited}
              favouritesCount={status.favouritesCount}
              isOwn={status.isOwn}
              neodbInstance={getStatusInstance(status.url)}
              onFavouriteChange={(next) => {
                updateStatus(status.id, (current) => ({
                  ...current,
                  favourited: next.favourited,
                  favouritesCount: next.count,
                }));
              }}
              onReblogChange={handleReblogChange}
              postId={status.interactionId}
              reblogged={status.reblogged}
              reblogsCount={status.reblogsCount}
              repliesCount={status.repliesCount}
              shareUrl={status.review.href || null}
              title={status.review.title}
            >
              <p className="whitespace-pre-line break-words text-[15px] leading-6 text-[#44474c] [overflow-wrap:anywhere]">
                {inlineBoldTitle(displayContent, status.review.title, status.contentEmojis, status.contentMentions, onNavigate)}
              </p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-[#75777d] transition group-hover:text-[var(--foreground)]">
                {t("community.readFullReview")}
                <ActivityReviewOpenIcon />
              </span>
            </ReviewReaderTrigger>
          ) : (
            <p className="mt-3 whitespace-pre-line break-words text-[15px] leading-6 text-[#44474c] [overflow-wrap:anywhere]">
              <SpoilerText emojis={status.contentEmojis} mentions={status.contentMentions} onNavigate={onNavigate} text={displayContent} />
            </p>
          )
        ) : null}

        {isContentVisible && translation.isExpanded && translation.translatedText ? (
          <p className="mt-2 whitespace-pre-line break-words border-l-2 border-[#c5c6cd]/30 pl-3 text-[15px] leading-6 text-[#44474c] [overflow-wrap:anywhere]">
            <SpoilerText emojis={status.contentEmojis} mentions={status.contentMentions} onNavigate={onNavigate} text={translation.translatedText} />
          </p>
        ) : null}

        {isContentVisible && status.item ? (
          <ActivityItem item={status.item} onNavigate={onNavigate} />
        ) : null}
        {isContentVisible && status.collection ? (
          <ActivityCollectionLink collection={status.collection} onNavigate={onNavigate} />
        ) : null}
        {isContentVisible && status.media.length > 0 ? (
          <ActivityMedia media={status.media} />
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-2 text-[#75777d] [&>button]:min-w-8 [&>button]:justify-center">
          <div className="mr-auto">
            {status.url ? (
              <a href={status.url} rel="noreferrer" target="_blank">
                <CommunityTime
                  className="text-xs font-semibold text-[#75777d] transition hover:text-[var(--foreground)]"
                  createdAt={status.createdAt}
                />
              </a>
            ) : (
              <CommunityTime createdAt={status.createdAt} />
            )}
          </div>
          <CommentFavouriteButton
            count={status.favouritesCount}
            disabled={false}
            favourited={status.favourited}
            hideZeroCount
            onChange={(next) => {
              updateStatus(status.id, (current) => ({
                ...current,
                favourited: next.favourited,
                favouritesCount: next.count,
              }));
            }}
            postId={status.interactionId}
          />
          <CommentReplies
            disabled={false}
            isOwnThread={status.isOwn}
            onNavigate={onNavigate}
            postId={status.id}
            repliesCount={status.repliesCount}
          />
          <BoostButton
            count={status.reblogsCount}
            onChange={handleReblogChange}
            postId={status.interactionId}
            reblogged={status.reblogged}
          />
          <ActivityMoreMenu
            canTranslate={
              translateEnabled && isContentVisible && Boolean(displayContent)
            }
            isLoading={translation.isLoading}
            isOwn={status.isOwn}
            onDeleted={() => onDelete?.(status.id)}
            onToggleTranslation={translation.toggleTranslation}
            postId={status.id}
            reblogTargetId={status.reblogAccount ? status.interactionId : null}
            url={status.url}
          />
        </div>
      </div>
    </article>
  );
});

function ActivityItem({
  item,
  onNavigate,
}: {
  item: NonNullable<TimelineStatus["item"]>;
  onNavigate?: (href: string) => void;
}) {
  const t = useT();
  const category = getActivityItemCategory(item.href);
  const content = (
    <>
      {item.cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          alt=""
          className="h-[4.5rem] w-[3.25rem] shrink-0 rounded-lg bg-[#dde3eb] object-cover shadow-sm"
          loading="lazy"
          src={item.cover}
        />
      ) : (
        <div className="grid h-[4.5rem] w-[3.25rem] shrink-0 place-items-center rounded-lg bg-[#dde3eb] text-[#75777d]">
          <ActivityBookIcon />
        </div>
      )}
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-bold leading-5 text-[var(--foreground)]">
          {item.title}
        </div>
        <div className="mt-1 text-xs font-semibold text-[#75777d]">
          {category ? t(`category.${category}`) : getActivityItemTypeLabel(item.type)}
        </div>
      </div>
      <ActivityChevronIcon />
    </>
  );

  const className =
    "mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-white/60 bg-white/45 p-2.5 shadow-sm transition hover:bg-white/70";

  return item.href.startsWith("/") ? (
    <Link
      className={className}
      href={item.href}
      onClick={() => {
        onNavigate?.(item.href);
        requestDetailScrollTopForHref(item.href);
        pushNavigationFrame("detail", item.href);
      }}
    >
      {content}
    </Link>
  ) : (
    <a className={className} href={item.href} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}

function ActivityCollectionLink({
  collection,
  onNavigate,
}: {
  collection: NonNullable<TimelineStatus["collection"]>;
  onNavigate?: (href: string) => void;
}) {
  const t = useT();

  const content = (
    <>
      <div className="grid h-[4.5rem] w-[3.25rem] shrink-0 place-items-center rounded-lg bg-[#dde3eb] text-[#75777d]">
        <ActivityCollectionIcon />
      </div>
      <div className="min-w-0">
        <div className="line-clamp-2 text-sm font-bold leading-5 text-[var(--foreground)]">
          {collection.title}
        </div>
        <div className="mt-1 text-xs font-semibold text-[#75777d]">
          {t("category.collection")}
        </div>
      </div>
      <ActivityChevronIcon />
    </>
  );

  const className =
    "mt-3 flex min-w-0 items-center gap-3 rounded-xl border border-white/60 bg-white/45 p-2.5 shadow-sm transition hover:bg-white/70";

  return collection.href.startsWith("/") ? (
    <Link
      className={className}
      href={collection.href}
      onClick={() => {
        onNavigate?.(collection.href);
        pushNavigationFrame("detail", collection.href);
      }}
    >
      {content}
    </Link>
  ) : (
    <a className={className} href={collection.href} rel="noreferrer" target="_blank">
      {content}
    </a>
  );
}

function ActivityMedia({ media }: { media: TimelineStatus["media"] }) {
  return (
    <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${media.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
      {media.map((entry) => (
        <a href={entry.url} key={entry.url} rel="noreferrer" target="_blank">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={entry.alt}
            className="max-h-72 w-full bg-[#dde3eb] object-cover"
            loading="lazy"
            src={entry.previewUrl}
          />
        </a>
      ))}
    </div>
  );
}

function ActivityMetric({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span className="inline-flex min-w-8 items-center justify-center gap-1 text-xs font-semibold">
      {icon}
      {value > 0 ? value : null}
    </span>
  );
}

function ActivityMoreMenu({
  canTranslate,
  isLoading,
  isOwn,
  onDeleted,
  onToggleTranslation,
  postId,
  reblogTargetId,
  url,
}: {
  canTranslate: boolean;
  isLoading: boolean;
  isOwn: boolean;
  onDeleted: () => void;
  onToggleTranslation: () => void;
  postId: string;
  reblogTargetId: string | null;
  url: string;
}) {
  const t = useT();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    if (isDeleting) return;

    setIsDeleting(true);
    try {
      // A reblog can't be deleted like an authored post; undoing the boost is
      // the equivalent action that removes it from the timeline.
      const response = reblogTargetId
        ? await fetch("/api/neodb/post-reblog", {
            body: JSON.stringify({ postId: reblogTargetId, reblog: false }),
            headers: { "Content-Type": "application/json" },
            method: "POST",
          })
        : await fetch("/api/neodb/post-delete", {
            body: JSON.stringify({ postId }),
            headers: { "Content-Type": "application/json" },
            method: "DELETE",
          });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      setIsDeleteOpen(false);
      onDeleted();
      showToast(t("timeline.delete.success"));
    } catch {
      showToast(t("timeline.delete.error"), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <>
      <ActionMenu
        buttonClassName="size-8"
        items={[
          canTranslate
            ? {
                disabled: isLoading,
                icon: <ActivityTranslateIcon isLoading={isLoading} />,
                label: t("community.translate"),
                onClick: onToggleTranslation,
              }
            : null,
          canTranslate && isOwn ? { type: "separator" as const } : null,
          isOwn
            ? {
                icon: <ActivityTrashIcon />,
                label: t("timeline.delete.label"),
                onClick: () => setIsDeleteOpen(true),
                tone: "danger" as const,
              }
            : null,
        ].filter((item): item is NonNullable<typeof item> => Boolean(item))}
        label={t("timeline.moreActions")}
        placement="top"
        triggerIcon={<ActivityMoreIcon />}
      />

      {isDeleteOpen ? (
        <ConfirmDialog
          confirmDisabled={isDeleting}
          confirmLabel={t("timeline.delete.confirm")}
          description={t("timeline.delete.description")}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={handleDelete}
          title={t("timeline.delete.title")}
        />
      ) : null}
    </>
  );
}

function ActivityVisibilityIcon({ visibility }: { visibility: string }) {
  const t = useT();
  const label = t(`timeline.visibility.${visibility}`);

  return (
    <button
      aria-label={label}
      className="inline-flex cursor-pointer text-[#75777d]"
      onClick={(event) => {
        event.stopPropagation();
        showToast(label);
      }}
      title={label}
      type="button"
    >
      {visibility === "direct" ? (
        <ActivityMailIcon />
      ) : visibility === "private" ? (
        <ActivityLockIcon />
      ) : (
        <ActivityGlobeIcon />
      )}
    </button>
  );
}

function getActivityItemCategory(href?: string) {
  return href ? /^\/item\/([^/]+)/.exec(href)?.[1] || "" : "";
}

function getActivityItemTypeLabel(type: string) {
  const value = type.replace(/([a-z])([A-Z])/g, "$1 $2").trim();
  return value || "NeoDB";
}

function getReviewActivitySummary(content: string, title: string) {
  const trimmedContent = content.trim();
  const trimmedTitle = title.trim();

  if (trimmedTitle && trimmedContent.startsWith(trimmedTitle)) {
    return trimmedContent.slice(trimmedTitle.length).trim();
  }

  return trimmedContent;
}

function inlineBoldTitle(
  content: string,
  title: string,
  emojis: Parameters<typeof SpoilerText>[0]["emojis"],
  mentions: Parameters<typeof SpoilerText>[0]["mentions"],
  onNavigate: Parameters<typeof SpoilerText>[0]["onNavigate"],
) {
  const idx = title ? content.indexOf(title) : -1;

  if (idx === -1) {
    return <SpoilerText emojis={emojis} mentions={mentions} onNavigate={onNavigate} text={content} />;
  }

  const before = content.slice(0, idx);
  const after = content.slice(idx + title.length);

  return (
    <>
      {before}
      <strong className="font-bold text-[#333e50]">{title}</strong>
      {after ? <SpoilerText emojis={emojis} mentions={mentions} onNavigate={onNavigate} text={after} /> : null}
    </>
  );
}

function getStatusInstance(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
}

function ActivityReviewOpenIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-3.5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m9 5 7 7-7 7" />
    </svg>
  );
}
function ActivityGlobeIcon() {
  return <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9S14.5 18.3 12 21c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z" /></svg>;
}
function ActivityLockIcon() {
  return <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="10" rx="2" width="14" x="5" y="10" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
function ActivityMailIcon() {
  return <svg aria-hidden="true" className="size-3.5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="14" rx="2" width="18" x="3" y="5" /><path d="m4 7 8 6 8-6" /></svg>;
}
function ActivityChevronIcon() {
  return <svg aria-hidden="true" className="ml-auto size-4 shrink-0 text-[#75777d]" fill="none" stroke="currentColor" strokeLinecap="round" strokeWidth="2" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7" /></svg>;
}
function ActivityBookIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M5 4h12a2 2 0 0 1 2 2v14H7a2 2 0 0 1-2-2Z" /><path d="M7 16h12M8 8h7" /></svg>;
}
function ActivityCollectionIcon() {
  return <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24"><rect height="14" rx="2" width="18" x="3" y="7" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
}
function ActivityTrashIcon() {
  return <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24"><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v5" /><path d="M14 11v5" /></svg>;
}
function ActivityMoreIcon() {
  return <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" /></svg>;
}
function ActivityTranslateIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 ${isLoading ? "animate-pulse" : ""}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12.87 15.07-2.54-2.51.03-.03A17.4 17.4 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17A16.6 16.6 0 0 1 9 11.35 14.6 14.6 0 0 1 6.69 8h-2a17.9 17.9 0 0 0 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04ZM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12Zm-2.62 7 1.62-4.33L19.12 17h-3.24Z" />
    </svg>
  );
}
