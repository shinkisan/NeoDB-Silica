"use client";

import { useT } from "@/components/use-t";
import { showToast } from "@/components/app-toast";
import { shareContent } from "@/lib/clipboard";

export function ShareProfileButton({
  url,
}: {
  url: string;
}) {
  const t = useT();

  async function shareProfile() {
    try {
      const shared = await shareContent({ url });
      if (!shared) {
        showToast(t("profile.loggedIn.copied"));
      }
    } catch {
      showToast(t("profile.loggedIn.copyError"), "error");
    }
  }

  return (
    <button
      className="inline-flex h-12 items-center gap-2 rounded-full bg-[#e2e2e5]/75 px-5 text-sm font-bold text-[#333e50] transition hover:bg-white/80"
      onClick={shareProfile}
      type="button"
    >
      <ShareIcon />
      {t("profile.loggedIn.share")}
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
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
