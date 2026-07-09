"use client";

import { lazy, Suspense, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useT } from "@/components/use-t";
import { showToast } from "@/components/app-toast";

const LazyReviewReader = lazy(() =>
  import("./review-reader").then((module) => ({ default: module.ReviewReader })),
);

type ReviewReaderTriggerProps = {
  apiUrl?: string | null;
  body?: string | null;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  externalUrl?: string | null;
  favourited?: boolean;
  favouritesCount?: number;
  isOwn?: boolean;
  itemUuid?: string;
  neodbInstance?: string;
  onFavouriteChange?: (next: { count: number; favourited: boolean }) => void;
  onReblogChange?: (next: { count: number; reblogged: boolean }) => void;
  postId?: string;
  reblogged?: boolean;
  reblogsCount?: number;
  repliesCount?: number;
  reviewUuid?: string | null;
  shareUrl?: string | null;
  showShare?: boolean;
  title: string;
};

type ReviewPayload = {
  body?: string;
  title?: string;
};

export function ReviewReaderTrigger({
  apiUrl,
  body,
  children,
  className = "",
  disabled,
  externalUrl,
  favourited,
  favouritesCount,
  isOwn,
  itemUuid,
  neodbInstance,
  onFavouriteChange,
  onReblogChange,
  postId,
  reblogged,
  reblogsCount,
  repliesCount,
  reviewUuid,
  shareUrl,
  showShare = true,
  title,
}: ReviewReaderTriggerProps) {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [review, setReview] = useState<ReviewPayload>({
    body: body || "",
    title,
  });
  const [liveFavourited, setLiveFavourited] = useState(favourited ?? false);
  const [liveFavouritesCount, setLiveFavouritesCount] = useState(favouritesCount ?? 0);
  const [liveReblogged, setLiveReblogged] = useState(reblogged ?? false);
  const [liveReblogsCount, setLiveReblogsCount] = useState(reblogsCount ?? 0);

  useEffect(() => { setLiveFavourited(favourited ?? false); }, [favourited]);
  useEffect(() => { setLiveFavouritesCount(favouritesCount ?? 0); }, [favouritesCount]);
  useEffect(() => { setLiveReblogged(reblogged ?? false); }, [reblogged]);
  useEffect(() => { setLiveReblogsCount(reblogsCount ?? 0); }, [reblogsCount]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  async function openReader() {
    setIsClosing(false);
    setIsOpen(true);
    setReview({
      body: body || review.body || "",
      title: title || review.title || t("reviewReader.fallbackTitle"),
    });

    if (body) {
      return;
    }

    const params = new URLSearchParams();

    if (itemUuid) {
      params.set("itemUuid", itemUuid);
    } else if (apiUrl) {
      params.set("apiUrl", apiUrl);
    } else if (reviewUuid) {
      params.set("reviewUuid", reviewUuid);
    } else {
      if (externalUrl) {
        window.open(externalUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`/api/neodb/review?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | (ReviewPayload & { error?: string })
        | null;

      if (!response.ok || !payload?.body) {
        throw new Error(payload?.error || t("reviewReader.loadError"));
      }

      setReview({
        body: payload.body,
        title: payload.title || title,
      });
    } catch (error) {
      showToast(error instanceof Error ? error.message : t("reviewReader.loadError"), "error");
    } finally {
      setIsLoading(false);
    }
  }

  function closeReader() {
    setIsClosing(true);

    window.setTimeout(() => {
      setIsOpen(false);
      setIsClosing(false);
    }, 160);
  }

  return (
    <>
      <button className={className} onClick={openReader} type="button">
        {children}
      </button>
      {isOpen
        ? createPortal(
            <Suspense fallback={<ReviewReaderFallback />}>
              <LazyReviewReader
                body={review.body || ""}
                disabled={disabled}
                favourited={liveFavourited}
                favouritesCount={liveFavouritesCount}
                isClosing={isClosing}
                isLoading={isLoading}
                isOwn={isOwn}
                neodbInstance={neodbInstance}
                onClose={closeReader}
                onFavouriteChange={(next) => {
                  setLiveFavourited(next.favourited);
                  setLiveFavouritesCount(next.count);
                  onFavouriteChange?.(next);
                }}
                onReblogChange={(next) => {
                  setLiveReblogged(next.reblogged);
                  setLiveReblogsCount(next.count);
                  onReblogChange?.(next);
                }}
                postId={postId}
                reblogged={liveReblogged}
                reblogsCount={liveReblogsCount}
                repliesCount={repliesCount}
                shareUrl={shareUrl || externalUrl || null}
                showShare={showShare}
                title={review.title || title}
              />
            </Suspense>,
            document.body,
          )
        : null}
    </>
  );
}

function ReviewReaderFallback() {
  return (
    <div className="fixed inset-0 z-[110] overflow-y-auto bg-[var(--background)] text-[var(--foreground)]">
      <div className="mx-auto max-w-3xl px-5 pb-16 pt-24">
        <div className="space-y-3">
          <div className="h-5 w-2/3 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="h-4 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="h-4 animate-pulse rounded-full bg-[#e2e2e5]" />
          <div className="h-4 w-5/6 animate-pulse rounded-full bg-[#e2e2e5]" />
        </div>
      </div>
    </div>
  );
}
