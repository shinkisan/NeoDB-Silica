import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export const BOTTOM_TAB_ORDER_EVENT = "app:bottom-tab-order";
export const BOTTOM_TAB_ORDER_KEY = `${STORAGE_PREFIX}v1:bottom-tab-order`;

export const bottomTabIds = [
  "discover",
  "timeline",
  "marked",
  "profile",
] as const;

export type BottomTabId = (typeof bottomTabIds)[number];

export function normalizeBottomTabOrder(value: unknown): BottomTabId[] {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const knownIds = new Set<string>(bottomTabIds);
  const orderedIds = ids.filter(
    (id, index): id is BottomTabId =>
      knownIds.has(id) && ids.indexOf(id) === index,
  );
  const missingIds = bottomTabIds.filter((id) => !orderedIds.includes(id));

  return [...orderedIds, ...missingIds];
}
