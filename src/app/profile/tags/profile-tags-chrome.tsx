"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActionMenu } from "@/components/action-menu";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/app-toast";
import { useT } from "@/components/use-t";
import { shareContent } from "@/lib/clipboard";
import { siteConfig } from "@/site.config";

export function ProfileTagsTopBar({
  backHref = "/profile",
  enableTagJump = false,
  neodbUrl,
  pageSelector = "[data-profile-tags-page]",
  showActions = false,
  title,
}: {
  backHref?: string;
  enableTagJump?: boolean;
  neodbUrl?: string | null;
  pageSelector?: string;
  showActions?: boolean;
  title: string;
}) {
  const router = useRouter();
  const t = useT();
  const [isTagJumpOpen, setIsTagJumpOpen] = useState(false);
  const [tagTitle, setTagTitle] = useState("");
  const [tagJumpError, setTagJumpError] = useState("");
  const [isFindingTag, setIsFindingTag] = useState(false);

  async function findTag() {
    const title = tagTitle.trim();

    if (!title || isFindingTag) {
      return;
    }

    setIsFindingTag(true);
    setTagJumpError("");

    try {
      const params = new URLSearchParams({ title });
      const response = await fetch(`/api/neodb/tags?${params.toString()}`);
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; items?: Array<{ title: string; uuid: string }> }
        | null;

      if (!response.ok) {
        throw new Error(payload?.error || t("profile.myTags.jumpError"));
      }

      const tag = payload?.items?.[0];

      if (!tag) {
        setTagJumpError(t("profile.myTags.notFound"));
        return;
      }

      setIsTagJumpOpen(false);
      router.push(
        `/profile/tags/${encodeURIComponent(tag.uuid)}?title=${encodeURIComponent(tag.title)}`,
      );
    } catch {
      setTagJumpError(t("profile.myTags.jumpError"));
    } finally {
      setIsFindingTag(false);
    }
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
          <button
            aria-label={title}
            className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70"
            onClick={() => {
              document
                .querySelector(pageSelector)
                ?.classList.add("detail-page-exit");

              window.setTimeout(() => {
                router.push(backHref);
              }, 180);
            }}
            type="button"
          >
            <CloseIcon />
          </button>
          <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--foreground)]">
            {title}
          </p>
          {enableTagJump ? (
            <button
              aria-label={t("profile.myTags.jump")}
              className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 active:scale-95"
              onClick={() => {
                setTagTitle("");
                setTagJumpError("");
                setIsTagJumpOpen(true);
              }}
              type="button"
            >
              <RocketIcon />
            </button>
          ) : showActions ? (
            <ActionMenu
              items={[
                {
                  icon: <ShareIcon />,
                  label: t("profile.myTags.share"),
                  onClick: async () => {
                    try {
                      const shared = await shareContent({
                        url: neodbUrl || window.location.href,
                      });
                      if (!shared) {
                        showToast(t("profile.myTags.copied"));
                      }
                    } catch {
                      showToast(t("profile.myTags.copyFailed"), "error");
                    }
                  },
                },
                neodbUrl
                  ? {
                      href: neodbUrl,
                      icon: <ExternalLinkMenuIcon />,
                      label: t("profile.myTags.openNeodb").replace("{server}", siteConfig.neodbName),
                    }
                  : {
                      disabled: true,
                      icon: <ExternalLinkMenuIcon />,
                      label: t("profile.myTags.openNeodb").replace("{server}", siteConfig.neodbName),
                    },
              ]}
              label={t("profile.myTags.actions")}
            />
          ) : (
            <div aria-hidden="true" className="size-10 shrink-0" />
          )}
        </div>
      </header>

      {isTagJumpOpen ? (
        <ConfirmDialog
          confirmDisabled={!tagTitle.trim() || isFindingTag}
          confirmLabel={
            isFindingTag
              ? t("profile.myTags.finding")
              : t("profile.myTags.jumpConfirm")
          }
          description={
            <>
              <input
                autoFocus
                aria-invalid={Boolean(tagJumpError)}
                className="h-12 w-full rounded-2xl border border-white/60 bg-white/55 px-4 text-base font-semibold text-[var(--foreground)] shadow-inner outline-none placeholder:text-[#75777d] focus:border-[#bcc7dd] aria-[invalid=true]:border-[#d55f68]"
                onChange={(event) => {
                  setTagTitle(event.target.value);
                  setTagJumpError("");
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void findTag();
                  }
                }}
                placeholder={t("profile.myTags.jumpPlaceholder")}
                value={tagTitle}
              />
              {tagJumpError ? (
                <p className="mt-2 px-1 text-sm font-semibold text-[#b94a55]">
                  {tagJumpError}
                </p>
              ) : null}
            </>
          }
          onCancel={() => {
            setIsTagJumpOpen(false);
            setTagJumpError("");
          }}
          onConfirm={() => void findTag()}
          title={t("profile.myTags.jump")}
        />
      ) : null}
    </>
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
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
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
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  );
}

function ExternalLinkMenuIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

function RocketIcon() {
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
      <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09Z" />
      <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.22 12.22 0 0 1 21.5 2.5c0 2.72-.78 7.5-6 10.5A22.35 22.35 0 0 1 12 15Z" />
      <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" />
      <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" />
    </svg>
  );
}
