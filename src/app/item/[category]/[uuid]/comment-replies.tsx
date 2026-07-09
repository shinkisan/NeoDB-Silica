"use client";

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { showToast } from "@/components/app-toast";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ProfileLink } from "@/components/profile-link";
import { SpoilerText } from "@/components/spoiler-text";
import { useT } from "@/components/use-t";
import { formatAccountHandle } from "@/lib/account-handle";
import type { MastodonMention } from "@/lib/mastodon-emoji";
import { CommentFavouriteButton } from "./comment-favourite-button";
import {
  CommentTranslationButton,
  useCommentTranslation,
} from "./comment-translation";
import { CommunityTime } from "./community-time";

type Reply = {
  acct: string;
  accountId: string;
  accountUrl: string;
  isRemote: boolean;
  avatar: string;
  content: string;
  createdAt: string;
  favourited: boolean;
  favouritesCount: number;
  hasRelatedItem: boolean;
  id: string;
  inReplyToId: string;
  isOwn: boolean;
  mentions: MastodonMention[];
  name: string;
  username: string;
};

const AUTO_NOTE_WARNING_DISMISSED_KEY = "bielu:v1:auto-note-reply-warning-dismissed";

// `performance.navigation` reflects how the current document was loaded and
// never changes for its lifetime, so reload detection must run once per
// document — not on every SPA remount of this component (which would wrongly
// treat back-navigation after a hard refresh as a reload and collapse threads).
let didHandleReplyReload = false;

function handleReplyThreadReload() {
  if (didHandleReplyReload || typeof window === "undefined") {
    return;
  }

  didHandleReplyReload = true;
  const navEntry = performance.getEntriesByType?.("navigation")?.[0] as
    | PerformanceNavigationTiming
    | undefined;

  if (navEntry?.type === "reload") {
    window.sessionStorage.removeItem("belu:replies-open");
  }
}

function isAutoNoteWarningDismissed() {
  try {
    return (
      window.localStorage.getItem(AUTO_NOTE_WARNING_DISMISSED_KEY) === "1"
    );
  } catch {
    return false;
  }
}

function dismissAutoNoteWarningPermanently() {
  try {
    window.localStorage.setItem(AUTO_NOTE_WARNING_DISMISSED_KEY, "1");
  } catch {
    // Local persistence is optional; failing to write should not block sending.
  }
}

export function CommentReplies({
  defaultExpanded = false,
  disabled,
  isOwnThread = false,
  neodbInstance,
  onNavigate,
  persistOpenState = true,
  postId,
  repliesCount = 0,
}: {
  defaultExpanded?: boolean;
  disabled: boolean;
  isOwnThread?: boolean;
  neodbInstance?: string;
  onNavigate?: (href: string) => void;
  persistOpenState?: boolean;
  postId: string;
  repliesCount?: number;
}) {
  const t = useT();
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [replies, setReplies] = useState<Reply[] | null>(null);
  const [draft, setDraft] = useState("");
  const [replyTargetId, setReplyTargetId] = useState(postId);
  const [pendingSubmitTarget, setPendingSubmitTarget] = useState<string | null>(null);
  const [shouldHideAutoNoteWarning, setShouldHideAutoNoteWarning] = useState(false);
  const draftRef = useRef(draft);
  const isSavingRef = useRef(isSaving);
  const repliesRef = useRef(replies);

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    isSavingRef.current = isSaving;
  }, [isSaving]);

  useEffect(() => {
    repliesRef.current = replies;
  }, [replies]);

  async function loadReplies({ keepOpenOnError = false } = {}) {
    if (replies || isLoading) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(
        `/api/neodb/post-replies?postId=${encodeURIComponent(postId)}`,
      );
      const payload = (await response.json().catch(() => null)) as {
        replies?: Reply[];
      } | null;

      if (!response.ok || !payload?.replies) {
        throw new Error("Replies unavailable");
      }

      setReplies(orderReplies(payload.replies, postId));
    } catch {
      if (!keepOpenOnError) setIsExpanded(false);
      showToast(t("community.repliesUnavailable"), "error");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    handleReplyThreadReload();
    const wasOpen =
      persistOpenState &&
      !disabled &&
      sessionStorage.getItem("belu:replies-open") === postId;
    if (!defaultExpanded && !wasOpen) return;
    if (disabled) return;
    setIsExpanded(true);
    void loadReplies({ keepOpenOnError: wasOpen });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!persistOpenState) return;

    if (isExpanded) {
      sessionStorage.setItem("belu:replies-open", postId);
    } else if (sessionStorage.getItem("belu:replies-open") === postId) {
      sessionStorage.removeItem("belu:replies-open");
    }
  }, [isExpanded, persistOpenState, postId]);

  async function toggleReplies() {
    if (disabled) {
      showToast(t("community.loginToViewReplies"));
      return;
    }

    if (isExpanded) {
      if (replyTargetId !== postId) {
        setReplyTargetId(postId);
        return;
      }

      setIsExpanded(false);
      return;
    }

    setIsExpanded(true);
    setReplyTargetId(postId);
    await loadReplies();
  }

  const submitReply = useCallback(
    async (targetId: string) => {
      const content = draftRef.current.trim();

      if (!content || isSavingRef.current) {
        return;
      }

      if (disabled) {
        showToast(t("community.loginToReply"), "error");
        return;
      }

      setIsSaving(true);

      try {
        const response = await fetch("/api/neodb/post-replies", {
          body: JSON.stringify({ content, postId: targetId }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        });
        const payload = (await response.json().catch(() => null)) as {
          reply?: Reply;
        } | null;

        if (!response.ok || !payload?.reply) {
          throw new Error("Reply failed");
        }

        setReplies((current) =>
          orderReplies([...(current || []), payload.reply!], postId),
        );
        setDraft("");
        setReplyTargetId(postId);
        showToast(t("community.replied"));
      } catch {
        showToast(t("community.replyUnavailable"), "error");
      } finally {
        setIsSaving(false);
      }
    },
    [disabled, postId, t],
  );

  const handleSubmit = useCallback(
    (targetId: string) => {
      if (isOwnThread && !isAutoNoteWarningDismissed()) {
        setPendingSubmitTarget(targetId);
        return;
      }
      submitReply(targetId);
    },
    [isOwnThread, submitReply],
  );

  function confirmAutoNoteWarning() {
    if (shouldHideAutoNoteWarning) {
      dismissAutoNoteWarningPermanently();
    }
    if (pendingSubmitTarget) {
      submitReply(pendingSubmitTarget);
    }
    setPendingSubmitTarget(null);
  }

  function dismissAutoNoteWarning() {
    setPendingSubmitTarget(null);
  }

  const handleDeleteReply = useCallback(
    (replyId: string) => {
      setReplies((current) => removeReplySubtree(current || [], replyId));
      setReplyTargetId((current) =>
        isReplyInSubtree(repliesRef.current || [], replyId, current)
          ? postId
          : current,
      );
    },
    [postId],
  );

  return (
    <>
      {pendingSubmitTarget !== null ? (
        <ConfirmDialog
          confirmLabel={t("community.autoNoteWarningContinue")}
          description={
            <div className="text-sm leading-6 text-[#44474c]">
              <p>
                {t("community.autoNoteWarningDesc")}{" "}
                {neodbInstance ? (
                  <a
                    className="font-semibold underline decoration-current/40 underline-offset-4"
                    href={`${neodbInstance}/account/preferences`}
                    rel="noopener noreferrer"
                    target="_blank"
                  >
                    {t("community.autoNoteWarningLink")}
                  </a>
                ) : null}
                {t("community.autoNoteWarningDescSuffix")}
              </p>
              <label className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold leading-none text-[#44474c]">
                <input
                  checked={shouldHideAutoNoteWarning}
                  className="m-0 size-3.5 shrink-0 accent-[var(--theme-primary)]"
                  onChange={(event) =>
                    setShouldHideAutoNoteWarning(event.target.checked)
                  }
                  type="checkbox"
                />
                <span className="leading-none">
                  {t("community.autoNoteWarningDontShowAgain")}
                </span>
              </label>
            </div>
          }
          onCancel={dismissAutoNoteWarning}
          onConfirm={confirmAutoNoteWarning}
          title={t("community.autoNoteWarningTitle")}
        />
      ) : null}
      <button
        aria-disabled={disabled}
        aria-expanded={isExpanded}
        aria-label={t("community.replies")}
        className={`relative grid size-8 cursor-pointer place-items-center rounded-full transition hover:bg-white/70 hover:text-[var(--foreground)] active:scale-95 aria-disabled:opacity-45 ${
          isExpanded ? "text-[var(--foreground)]" : "text-[#75777d]"
        }`}
        onClick={toggleReplies}
        title={t("community.replies")}
        type="button"
      >
        <ReplyIcon isLoading={isLoading} />
        {repliesCount > 0 && !isLoading ? (
          <span className="pointer-events-none absolute right-2 top-2 size-1.5 rounded-full bg-current" />
        ) : null}
      </button>

      {isExpanded ? (
        <div className="order-last basis-full pt-1">
          <div className="ml-1 border-l border-[#d9d9de]/80 pl-4">
            {replyTargetId === postId ? (
              <ReplyComposer
                disabled={disabled}
                draft={draft}
                isSaving={isSaving}
                onChange={setDraft}
                onSubmit={() => handleSubmit(postId)}
              />
            ) : null}
            {isLoading ? (
              <div className="mt-4">
                <ReplySkeleton />
              </div>
            ) : replies?.length ? (
              <div className="mt-4 space-y-4">
                {replies.map((reply) => (
                  <ReplyItem
                    composer={
                      replyTargetId === reply.id ? (
                        <ReplyComposer
                          disabled={disabled}
                          draft={draft}
                          isSaving={isSaving}
                          onChange={setDraft}
                          onSubmit={() => handleSubmit(reply.id)}
                          replyToName={reply.name}
                        />
                      ) : null
                    }
                    disabled={disabled}
                    isComposerOpen={replyTargetId === reply.id}
                    key={reply.id}
                    onDelete={handleDeleteReply}
                    onNavigate={onNavigate}
                    onReply={setReplyTargetId}
                    reply={reply}
                    replyToUsername={getReplyToUsername(replies, reply, postId)}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-4 text-xs font-semibold text-[#75777d]">
                {t("community.noReplies")}
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

const ReplyItem = memo(function ReplyItem({
  composer,
  disabled,
  isComposerOpen,
  onDelete,
  onNavigate,
  onReply,
  reply,
  replyToUsername,
}: {
  composer: ReactNode;
  disabled: boolean;
  isComposerOpen: boolean;
  onDelete: (replyId: string) => void;
  onNavigate?: (href: string) => void;
  onReply: (replyId: string) => void;
  reply: Reply;
  replyToUsername: string | null;
}) {
  const [didAvatarFail, setDidAvatarFail] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const t = useT();
  const translation = useCommentTranslation(reply.content);
  const accountHandle = formatAccountHandle(reply.acct || reply.username);
  async function deleteReply() {
    if (isDeleting) {
      return;
    }

    setIsDeleting(true);

    try {
      const response = await fetch("/api/neodb/post-replies", {
        body: JSON.stringify({ postId: reply.id }),
        headers: { "Content-Type": "application/json" },
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Delete failed");
      }

      onDelete(reply.id);
      setIsDeleteOpen(false);
      showToast(t("community.replyDeleted"));
    } catch {
      showToast(t("community.replyDeleteUnavailable"), "error");
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <div>
      <div className="flex min-w-0 gap-3">
        <ProfileLink
          accountId={reply.accountId}
          ariaLabel={reply.name}
          className="shrink-0 rounded-full transition active:scale-95"
          isRemote={reply.isRemote}
          onNavigate={onNavigate}
          url={reply.accountUrl}
        >
          {reply.avatar && !didAvatarFail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt=""
              className="size-8 rounded-full border border-white bg-[#dde3eb] object-cover"
              loading="lazy"
              onError={() => setDidAvatarFail(true)}
              src={reply.avatar}
            />
          ) : (
            <div className="grid size-8 place-items-center rounded-full border border-white bg-[#dde3eb] text-xs font-bold text-[#333e50]">
              {reply.name.slice(0, 1)}
            </div>
          )}
        </ProfileLink>
        <div className="min-w-0 flex-1 leading-5">
          <ProfileLink
            accountId={reply.accountId}
            className="text-xs font-bold text-[var(--foreground)] transition hover:underline active:opacity-70"
            isRemote={reply.isRemote}
            onNavigate={onNavigate}
            url={reply.accountUrl}
          >
            {reply.name}
          </ProfileLink>
          {accountHandle ? (
            <div className="mt-0.5 truncate text-[0.6875rem] font-semibold leading-4 text-[#75777d]">
              {accountHandle}
            </div>
          ) : null}
          <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-[#44474c] [overflow-wrap:anywhere]">
            {replyToUsername ? (
              <>
                <span>{t("community.replyToPrefix")}</span>
                <span className="text-[#75777d]">{replyToUsername}</span>
                <span>{t("community.replyToSeparator")}</span>
              </>
            ) : null}
            <SpoilerText mentions={reply.mentions} onNavigate={onNavigate} text={reply.content} />
          </p>
          {translation.isExpanded && translation.translatedText ? (
            <p className="mt-2 whitespace-pre-line break-words border-l-2 border-[#c5c6cd]/60 pl-3 text-sm leading-relaxed text-[#5f6268] [overflow-wrap:anywhere]">
              <SpoilerText
                mentions={reply.mentions}
                onNavigate={onNavigate}
                text={translation.translatedText}
              />
            </p>
          ) : null}
          <CommunityTime
            className="mt-1 text-[0.6875rem] font-semibold text-[#75777d]"
            createdAt={reply.createdAt}
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[#75777d]">
            <CommentFavouriteButton
              count={reply.favouritesCount}
              disabled={disabled}
              favourited={reply.favourited}
              postId={reply.id}
            />
            {!(reply.isOwn && reply.hasRelatedItem) ? (
              <button
                aria-label={t("community.replies")}
                className={`grid size-8 cursor-pointer place-items-center rounded-full transition hover:bg-white/70 hover:text-[var(--foreground)] active:scale-95 ${
                  isComposerOpen ? "text-[var(--foreground)]" : "text-[#75777d]"
                }`}
                onClick={() => onReply(reply.id)}
                title={t("community.replies")}
                type="button"
              >
                <ReplyIcon isLoading={false} />
              </button>
            ) : null}
            <span className="-ml-1.5">
              <CommentTranslationButton
                isExpanded={translation.isExpanded}
                isLoading={translation.isLoading}
                onClick={translation.toggleTranslation}
              />
            </span>
            {reply.isOwn ? (
              <button
                aria-label={t("community.deleteReply")}
                className="-ml-1.5 grid size-8 cursor-pointer place-items-center rounded-full text-[#75777d] transition hover:bg-white/70 hover:text-red-600 active:scale-95 disabled:cursor-wait disabled:opacity-40"
                disabled={isDeleting}
                onClick={() => setIsDeleteOpen(true)}
                title={t("community.deleteReply")}
                type="button"
              >
                <TrashIcon isLoading={isDeleting} />
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {isComposerOpen ? <div className="mt-3">{composer}</div> : null}
      {isDeleteOpen ? (
        <ConfirmDialog
          confirmLabel={t("community.delete")}
          description={t("community.deleteReplyDesc")}
          onCancel={() => setIsDeleteOpen(false)}
          onConfirm={deleteReply}
          title={t("community.deleteReplyTitle")}
        />
      ) : null}
    </div>
  );
});

function ReplyComposer({
  disabled,
  draft,
  isSaving,
  onChange,
  onSubmit,
  replyToName,
}: {
  disabled: boolean;
  draft: string;
  isSaving: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  replyToName?: string;
}) {
  const t = useT();

  return (
    <div className="flex items-end gap-2">
      <textarea
        aria-label={t("community.replyPlaceholder")}
        className="h-10 min-w-0 flex-1 resize-none rounded-xl border border-[#d9d9de]/80 bg-white/55 px-3 py-[9px] text-sm leading-5 text-[var(--foreground)] outline-none transition placeholder:text-[#9a9ca2] focus:border-[var(--theme-primary)] focus:bg-white/75"
        disabled={disabled || isSaving}
        maxLength={500}
        onChange={(event) => onChange(event.target.value)}
        placeholder={
          disabled
            ? t("community.loginToReply")
            : replyToName
              ? `${t("community.replyToPrefix")}${replyToName}`
              : t("community.replyPlaceholder")
        }
        rows={1}
        value={draft}
      />
      <button
        aria-label={t("community.sendReply")}
        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full bg-[var(--theme-primary)] text-white shadow-md transition hover:bg-[var(--theme-primary-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={disabled || isSaving || !draft.trim()}
        onClick={onSubmit}
        type="button"
      >
        <SendIcon isLoading={isSaving} />
      </button>
    </div>
  );
}

function orderReplies(replies: Reply[], rootPostId: string) {
  const repliesByParent = new Map<string, Reply[]>();
  const repliesById = new Map(replies.map((reply) => [reply.id, reply]));

  for (const reply of replies) {
    const parentId = repliesById.has(reply.inReplyToId)
      ? reply.inReplyToId
      : rootPostId;
    const siblings = repliesByParent.get(parentId) || [];
    siblings.push(reply);
    repliesByParent.set(parentId, siblings);
  }

  for (const siblings of repliesByParent.values()) {
    siblings.sort(compareReplyTime);
  }

  const ordered: Reply[] = [];
  const visited = new Set<string>();

  function appendChildren(parentId: string) {
    for (const reply of repliesByParent.get(parentId) || []) {
      if (visited.has(reply.id)) {
        continue;
      }

      visited.add(reply.id);
      ordered.push(reply);
      appendChildren(reply.id);
    }
  }

  for (const reply of repliesByParent.get(rootPostId) || []) {
    if (visited.has(reply.id)) {
      continue;
    }

    visited.add(reply.id);
    ordered.push(reply);
    appendChildren(reply.id);
  }

  for (const reply of [...replies].sort(compareReplyTime)) {
    if (!visited.has(reply.id)) {
      visited.add(reply.id);
      ordered.push(reply);
      appendChildren(reply.id);
    }
  }

  return ordered;
}

function getReplyToUsername(
  replies: Reply[],
  reply: Reply,
  rootPostId: string,
) {
  if (!reply.inReplyToId || reply.inReplyToId === rootPostId) {
    return null;
  }

  const parent = replies.find((entry) => entry.id === reply.inReplyToId);
  return parent?.name || parent?.username || null;
}

function compareReplyTime(first: Reply, second: Reply) {
  const firstTime = new Date(first.createdAt).getTime();
  const secondTime = new Date(second.createdAt).getTime();

  if (Number.isNaN(firstTime) || Number.isNaN(secondTime)) {
    return first.id.localeCompare(second.id);
  }

  return firstTime - secondTime || first.id.localeCompare(second.id);
}

function removeReplySubtree(replies: Reply[], rootReplyId: string) {
  const removedIds = collectReplySubtreeIds(replies, rootReplyId);
  return replies.filter((reply) => !removedIds.has(reply.id));
}

function isReplyInSubtree(
  replies: Reply[],
  rootReplyId: string,
  replyId: string,
) {
  return collectReplySubtreeIds(replies, rootReplyId).has(replyId);
}

function collectReplySubtreeIds(replies: Reply[], rootReplyId: string) {
  const childrenByParent = new Map<string, string[]>();

  for (const reply of replies) {
    const children = childrenByParent.get(reply.inReplyToId) || [];
    children.push(reply.id);
    childrenByParent.set(reply.inReplyToId, children);
  }

  const ids = new Set<string>();
  const pending = [rootReplyId];

  while (pending.length > 0) {
    const replyId = pending.pop()!;

    if (ids.has(replyId)) {
      continue;
    }

    ids.add(replyId);
    pending.push(...(childrenByParent.get(replyId) || []));
  }

  return ids;
}

function ReplySkeleton() {
  return (
    <div className="flex animate-pulse gap-3">
      <div className="size-8 shrink-0 rounded-full bg-[#dde3eb]" />
      <div className="flex-1 space-y-2 pt-1">
        <div className="h-2.5 w-20 rounded-full bg-[#dde3eb]" />
        <div className="h-2.5 w-4/5 rounded-full bg-[#dde3eb]" />
      </div>
    </div>
  );
}

function ReplyIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`size-4 bg-current [mask-image:url('/icons/material-chat-bubble-outline.svg')] [mask-position:center] [mask-repeat:no-repeat] [mask-size:contain] ${isLoading ? "animate-pulse" : ""}`}
    />
  );
}

function SendIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 -translate-x-px translate-y-px ${isLoading ? "animate-pulse" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="m22 2-7 20-4-9-9-4Z" />
      <path d="M22 2 11 13" />
    </svg>
  );
}

function TrashIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 ${isLoading ? "animate-pulse" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v5" />
      <path d="M14 11v5" />
    </svg>
  );
}
