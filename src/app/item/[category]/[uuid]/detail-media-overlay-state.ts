"use client";

export function setDetailMediaOverlayState(isOpen: boolean) {
  document.documentElement.dataset.detailMediaOverlayOpen = isOpen
    ? "true"
    : "false";
  window.dispatchEvent(
    new CustomEvent("app:detail-media-overlay", { detail: isOpen }),
  );
}
