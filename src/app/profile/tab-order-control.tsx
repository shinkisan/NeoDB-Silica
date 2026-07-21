"use client";

import { lazy, Suspense, useState } from "react";
import { useT } from "@/components/use-t";
import {
  BOTTOM_TAB_ORDER_EVENT,
  BOTTOM_TAB_ORDER_KEY,
  bottomTabIds,
} from "@/lib/bottom-tabs";

const LazyCategoryOrderDialog = lazy(() =>
  import("@/components/category-order-dialog").then((module) => ({
    default: module.CategoryOrderDialog,
  })),
);

export function TabOrderButton() {
  const t = useT();
  const [isOpen, setIsOpen] = useState(false);
  const items = bottomTabIds.map((id) => ({
    id,
    label: t(`bottomNav.${id}`),
  }));

  return (
    <>
      <button
        aria-label={t("profile.tabOrder")}
        className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/50 px-3 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95"
        onClick={() => setIsOpen(true)}
        type="button"
      >
        {t("profile.appearance.tabOrder.button")}
      </button>
      {isOpen ? (
        <Suspense fallback={null}>
          <LazyCategoryOrderDialog
            closeLabel={t("profile.appearance.tabOrder.close")}
            eventName={BOTTOM_TAB_ORDER_EVENT}
            items={items}
            moveDownLabel={t("profile.appearance.tabOrder.moveDown")}
            moveUpLabel={t("profile.appearance.tabOrder.moveUp")}
            onClose={() => setIsOpen(false)}
            resetLabel={t("profile.appearance.tabOrder.resetDefault")}
            storageKey={BOTTOM_TAB_ORDER_KEY}
            title={t("profile.appearance.tabOrder.dialogTitle")}
          />
        </Suspense>
      ) : null}
    </>
  );
}
