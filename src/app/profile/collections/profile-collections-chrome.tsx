"use client";

import { useRouter } from "next/navigation";

export function ProfileCollectionsTopBar({ title }: { title: string }) {
  const router = useRouter();

  return (
    <header className="fixed inset-x-0 top-0 z-[60] border-b border-white/30 bg-white/60 px-5 shadow-sm shadow-slate-900/5 backdrop-blur-2xl">
      <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 lg:max-w-4xl">
        <button
          aria-label={title}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70"
          onClick={() => {
            document
              .querySelector("[data-profile-collections-page]")
              ?.classList.add("detail-page-exit");

            window.setTimeout(() => {
              router.push("/profile");
            }, 180);
          }}
          type="button"
        >
          <CloseIcon />
        </button>
        <p className="min-w-0 flex-1 truncate text-base font-bold text-[var(--foreground)]">
          {title}
        </p>
      </div>
    </header>
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
