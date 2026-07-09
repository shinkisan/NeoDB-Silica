"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { remarkSpoiler } from "@/lib/remark-spoiler";
import { SpoilerText } from "@/components/spoiler-text";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import { shareContent } from "@/lib/clipboard";
import { CommentFavouriteButton } from "@/app/item/[category]/[uuid]/comment-favourite-button";
import { CommentReplies } from "@/app/item/[category]/[uuid]/comment-replies";
import { BoostButton } from "@/components/boost-button";

export function ReviewReader({
  body,
  disabled,
  favourited,
  favouritesCount,
  isClosing,
  isLoading,
  isOwn,
  neodbInstance,
  onClose,
  onFavouriteChange,
  onReblogChange,
  postId,
  reblogged,
  reblogsCount,
  repliesCount,
  shareUrl,
  showShare = true,
  title,
}: {
  body: string;
  disabled?: boolean;
  favourited?: boolean;
  favouritesCount?: number;
  isClosing: boolean;
  isLoading: boolean;
  isOwn?: boolean;
  neodbInstance?: string;
  onClose: () => void;
  onFavouriteChange?: (next: { count: number; favourited: boolean }) => void;
  onReblogChange?: (next: { count: number; reblogged: boolean }) => void;
  postId?: string;
  reblogged?: boolean;
  reblogsCount?: number;
  repliesCount?: number;
  shareUrl?: string | null;
  showShare?: boolean;
  title: string;
}) {
  const t = useT();
  const titleFrameRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const [isTitleOverflowing, setIsTitleOverflowing] = useState(false);

  useEffect(() => {
    const scrollY = window.scrollY;

    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  useEffect(() => {
    function measureTitle() {
      const frame = titleFrameRef.current;
      const titleNode = titleRef.current;

      if (!frame || !titleNode) {
        return;
      }

      setIsTitleOverflowing(titleNode.scrollWidth > frame.clientWidth);
    }

    measureTitle();

    const observer = new ResizeObserver(measureTitle);

    if (titleFrameRef.current) {
      observer.observe(titleFrameRef.current);
    }

    return () => {
      observer.disconnect();
    };
  }, [title]);

  return (
    <div
      className={`fixed inset-0 z-[110] overflow-y-auto bg-[var(--background)] text-[var(--foreground)] ${
        isClosing ? "review-reader-exit" : "review-reader-enter"
      }`}
      onClick={(event) => event.stopPropagation()}
    >
      <header className="sticky top-0 z-10 w-screen border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-4xl items-center gap-3">
          <button
            aria-label={t("reviewReader.close")}
            className="grid size-10 shrink-0 place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
            onClick={onClose}
            type="button"
          >
            <CloseIcon />
          </button>
          <div
            className="relative min-w-0 flex-1 overflow-hidden whitespace-nowrap text-base font-bold text-[var(--foreground)]"
            ref={titleFrameRef}
          >
            {isTitleOverflowing ? (
              <span className="detail-title-marquee inline-flex">
                <span className="pr-6">{title || t("reviewReader.fallbackTitle")}</span>
                <span aria-hidden="true" className="pr-6">
                  {title || t("reviewReader.fallbackTitle")}
                </span>
              </span>
            ) : (
              <span>{title || t("reviewReader.fallbackTitle")}</span>
            )}
            <span
              aria-hidden="true"
              className="pointer-events-none invisible absolute whitespace-nowrap"
              ref={titleRef}
            >
              {title || t("reviewReader.fallbackTitle")}
            </span>
          </div>
          {showShare ? (
            <button
              aria-label={t("detail.tools.share")}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
              onClick={async () => {
                try {
                  const shared = await shareContent({
                    url: shareUrl || window.location.href,
                  });
                  if (!shared) {
                    showToast(t("reviewReader.copied"));
                  }
                } catch {
                  showToast(t("detail.tools.copyFailed"), "error");
                }
              }}
              type="button"
            >
              <ShareIcon />
            </button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 pb-16 pt-8">
        {isLoading ? (
          <div className="space-y-3">
            <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 animate-pulse rounded-full bg-[#e2e2e5]" />
            <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
          </div>
        ) : (
          <>
            <MarkdownBody body={body || t("reviewReader.emptyBody")} />
            {postId ? (
              <div className="mt-6 flex flex-wrap items-center gap-x-2 border-t border-[#e2e2e5] pt-4 text-[#75777d]">
                <CommentFavouriteButton
                  count={favouritesCount ?? 0}
                  disabled={disabled ?? false}
                  favourited={favourited ?? false}
                  onChange={onFavouriteChange}
                  postId={postId}
                />
                <CommentReplies
                  defaultExpanded
                  disabled={disabled ?? false}
                  isOwnThread={isOwn ?? false}
                  onNavigate={onClose}
                  persistOpenState={false}
                  postId={postId}
                  repliesCount={repliesCount ?? 0}
                />
                <BoostButton
                  count={reblogsCount ?? 0}
                  disabled={disabled ?? false}
                  onChange={onReblogChange ?? (() => {})}
                  postId={postId}
                  reblogged={reblogged ?? false}
                />
              </div>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}

function MarkdownBody({ body }: { body: string }) {
  return (
    <article className="markdown-body space-y-4 text-[var(--foreground)]">
      <ReactMarkdown
        components={
          {
            spoiler: ({ children }: { children?: React.ReactNode }) => {
              const text =
              typeof children === "string"
                ? children
                : Array.isArray(children)
                  ? String(children[0] || "")
                  : "";
            return <SpoilerText text={text} />;
          },
          a: ({ children, href, ...rest }) => (
            <a
              {...rest}
              className="font-semibold text-[#2563eb] underline decoration-current/30 underline-offset-4 transition hover:text-[#1d4ed8]"
              href={href}
              rel="noreferrer"
              target="_blank"
            >
              {children}
            </a>
          ),
          h1: ({ children }) => (
            <h1 className="pt-2 text-xl font-bold leading-snug text-[var(--foreground)]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="pt-2 text-xl font-bold leading-snug text-[var(--foreground)]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="pt-2 text-xl font-bold leading-snug text-[var(--foreground)]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <div className="whitespace-pre-line text-base leading-8 text-[#44474c]">
              {children}
            </div>
          ),
          ul: ({ children }) => (
            <ul className="space-y-2 pl-5 text-base leading-8 text-[#44474c] list-disc">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-2 pl-5 text-base leading-8 text-[#44474c] list-decimal">
              {children}
            </ol>
          ),
          img: ({ src, alt }) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img alt={alt} className="max-w-full rounded-xl" src={src} />
          ),
        } as Partial<Components>}
        remarkPlugins={[remarkGfm, remarkSpoiler]}
      >
        {body}
      </ReactMarkdown>
    </article>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 13.5 6.8 4" />
      <path d="m15.4 6.5-6.8 4" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-5"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2.2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
