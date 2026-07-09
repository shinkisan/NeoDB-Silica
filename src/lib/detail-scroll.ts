export const DETAIL_SCROLL_TOP_PREFIX = "bielu:v1:detail-scroll-top:";

export function requestDetailScrollTopForHref(href: string) {
  if (typeof window === "undefined") {
    return;
  }

  const itemUuid = getDetailItemUuidFromHref(href);

  if (!itemUuid) {
    return;
  }

  window.sessionStorage.setItem(`${DETAIL_SCROLL_TOP_PREFIX}${itemUuid}`, "1");
}

function getDetailItemUuidFromHref(href: string) {
  const url = new URL(href, window.location.origin);
  const match = /^\/item\/[^/]+\/([^/?#]+)/.exec(url.pathname);

  return match ? decodeURIComponent(match[1]) : null;
}
