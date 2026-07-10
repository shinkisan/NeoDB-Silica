"use client";

import { useState } from "react";
import { useT } from "@/components/use-t";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { showToast } from "@/components/app-toast";
import { APP_RESET_EVENT } from "@/lib/app-reset";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const APP_STORAGE_PREFIX = STORAGE_PREFIX;

export function CacheControlButton() {
  const t = useT();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  function resetAppData() {
    const cleared = clearAppCache();
    window.dispatchEvent(new Event(APP_RESET_EVENT));
    setIsConfirmOpen(false);
    showToast(cleared > 0 ? t("profile.cache.cleared") : t("profile.cache.noData"));
  }

  return (
    <div className="relative">
      <button
        className="rounded-full border border-white/70 bg-white/45 px-4 py-1.5 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95"
        onClick={() => setIsConfirmOpen(true)}
        type="button"
      >
        {t("profile.cache.reset")}
      </button>
       {isConfirmOpen ? (
        <ConfirmDialog
          confirmLabel={t("profile.cache.confirmLabel")}
          description={t("profile.cache.confirmDescription")}
          onCancel={() => setIsConfirmOpen(false)}
          onConfirm={resetAppData}
          title={t("profile.cache.confirmTitle")}
        />
      ) : null}
    </div>
  );
}

function clearAppCache() {
  return [window.localStorage, window.sessionStorage].reduce(
    (cleared, storage) => {
      const keys = collectAppCacheKeys(storage);

      for (const key of keys) {
        storage.removeItem(key);
      }

      return cleared + keys.length;
    },
    0,
  );
}

function collectAppCacheKeys(storage: Storage) {
  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);

    if (key && isAppCacheKey(key)) {
      keys.push(key);
    }
  }

  return keys;
}

function isAppCacheKey(key: string) {
  return key.startsWith(APP_STORAGE_PREFIX);
}
