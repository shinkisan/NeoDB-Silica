export type HomeTag = {
  id: string;
  label: string;
};

export const HOME_TAG_ORDER_EVENT = "bielu:home-tag-order";
export const HOME_TAG_ORDER_KEY = "bielu:v1:home-tag-order";

export const homeTags: HomeTag[] = [
  { id: "book", label: "图书" },
  { id: "movie", label: "电影" },
  { id: "tv", label: "剧集" },
  { id: "music", label: "音乐" },
  { id: "game", label: "游戏" },
  { id: "podcast", label: "播客" },
  { id: "collection", label: "收藏单" },
];

export const DEFAULT_HOME_CATEGORY = homeTags[0].id;

export function normalizeHomeTagOrder(value: unknown) {
  const ids = Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
  const knownIds = new Set(homeTags.map((tag) => tag.id));
  const orderedIds = ids.filter((id, index) => knownIds.has(id) && ids.indexOf(id) === index);
  const missingIds = homeTags
    .map((tag) => tag.id)
    .filter((id) => !orderedIds.includes(id));

  return [...orderedIds, ...missingIds];
}

export function sortHomeTags(order: string[]) {
  const normalizedOrder = normalizeHomeTagOrder(order);

  return normalizedOrder
    .map((id) => homeTags.find((tag) => tag.id === id))
    .filter((tag): tag is HomeTag => Boolean(tag));
}
