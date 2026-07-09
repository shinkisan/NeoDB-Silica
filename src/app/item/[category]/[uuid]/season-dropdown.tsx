"use client";

import { useRouter } from "next/navigation";
import { Dropdown } from "@/components/dropdown";
import { useT } from "@/components/use-t";
import { replaceNavigationFrame } from "@/components/navigation-history";
import { saveCurrentDetailScroll } from "./detail-scroll-controls";

export type SeasonOption = {
  label: string;
  uuid: string;
};

export function SeasonDropdown({
  currentUuid,
  itemUuid,
  options,
  triggerLabel,
}: {
  currentUuid: string | null;
  itemUuid: string;
  options: SeasonOption[];
  triggerLabel: string;
}) {
  const t = useT();
  const router = useRouter();

  return (
    <Dropdown
      ariaLabel={t("detail.seasons.ariaLabel")}
      buttonClassName="h-6 gap-1 border-none bg-transparent px-1.5 text-xs font-semibold text-[#75777d] shadow-none hover:bg-black/5"
      maxVisibleOptions={5}
      onChange={(uuid) => {
        if (uuid === currentUuid) return;

        const href = `/item/tv-season/${encodeURIComponent(uuid)}`;
        saveCurrentDetailScroll(itemUuid);
        replaceNavigationFrame("detail", href);
        router.replace(href);
      }}
      options={options.map((option) => ({ id: option.uuid, label: option.label }))}
      triggerLabel={triggerLabel}
      value={currentUuid ?? ""}
    />
  );
}
