"use client";

import { useRouter } from "next/navigation";
import { FloatingTopBar, TopBarIsland } from "@/components/floating-top-bar";

export function ProfileCollectionsTopBar({ title }: { title: string }) {
  const router = useRouter();

  return (
    <FloatingTopBar className="fixed inset-x-0 top-0 z-[60]" rowClassName="max-w-2xl lg:max-w-4xl">
      <TopBarIsland>
        <button
          aria-label={title}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-[#44474c] transition hover:bg-white/70 press-icon disabled:cursor-default"
          onClick={(event) => {
            event.currentTarget.disabled = true;
            router.push("/profile");
          }}
          type="button"
        >
          <CloseIcon />
        </button>
      </TopBarIsland>
      <p className="min-w-0 flex-1 truncate text-center text-base font-bold text-[var(--foreground)]">
        {title}
      </p>
      <div aria-hidden="true" className="size-10 shrink-0" />
    </FloatingTopBar>
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
