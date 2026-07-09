"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useT } from "@/components/use-t";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { clearMarkedListCache } from "@/lib/marked-list-cache";
import { clearTimelineCache } from "@/lib/timeline-cache";

const PROFILE_CACHE_PREFIXES = [
  "bielu:v1:profile:",
];

export function LogoutButton() {
  const t = useT();
  const router = useRouter();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function logout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    setIsConfirmOpen(false);

    try {
      await fetch("/api/auth/neodb/logout", { method: "POST" });
      clearProfileCache();
      clearMarkedListCache();
      clearTimelineCache();
      router.refresh();
    } finally {
      setIsLoggingOut(false);
    }
  }

  return (
    <>
      <button
        className="mx-auto inline-flex items-center justify-center px-4 py-2 text-sm font-bold text-red-700 transition hover:text-red-800 active:scale-95 disabled:cursor-wait disabled:text-[#a4a6ad]"
        disabled={isLoggingOut}
        onClick={() => setIsConfirmOpen(true)}
        type="button"
      >
        {isLoggingOut ? t("profile.logout.loggingOut") : t("profile.logout.button")}
      </button>

      {isConfirmOpen ? (
        <ConfirmDialog
          confirmLabel={t("profile.logout.confirmLabel")}
          description={t("profile.logout.confirmDescription")}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={logout}
          title={t("profile.logout.confirmTitle")}
        />
      ) : null}
    </>
  );
}

function clearProfileCache() {
  for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
    const key = window.localStorage.key(index);

    if (key && PROFILE_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }
}
