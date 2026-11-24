"use client";

/// <reference types="react/canary" />

import { ViewTransition, useSyncExternalStore, type ReactNode } from "react";
import { flushSync } from "react-dom";

let selected: { key: string; id: string; src?: string } | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function selectTransitionCover(target: EventTarget | null) {
  if (process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "1" || !(target instanceof Element)) return;
  const link = target.closest("a[href], [role=link]");
  const cover = link?.querySelector<HTMLElement>("[data-motion-cover-source]");
  const key = cover?.dataset.motionCoverSource;
  const id = cover?.dataset.motionCoverId;
  if (!key || !id) return;
  const image = cover.querySelector("img");
  const src = image?.complete && image.naturalWidth > 0 ? image.currentSrc : undefined;
  if (selected?.key === key && selected.src === src) return;
  flushSync(() => {
    selected = { key, id, src };
    for (const listener of listeners) listener();
  });
}

export function CoverTransition({
  children, id, sourceKey, className,
}: {
  children: ReactNode;
  id: string;
  sourceKey?: string;
  className: string;
}) {
  if (process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "1") {
    return <div className={className}>{children}</div>;
  }
  return <ActiveCover id={id} sourceKey={sourceKey} className={className}>{children}</ActiveCover>;
}

function ActiveCover({
  children, id, sourceKey, className,
}: Parameters<typeof CoverTransition>[0]) {
  const active = useSyncExternalStore(subscribe, () => selected?.key === sourceKey, () => false);
  const shared = !sourceKey || active;
  return (
    <ViewTransition
      default="none"
      name={shared ? `cover-${id.replace(/[^a-zA-Z0-9_-]/g, "_")}` : undefined}
      share={shared ? "cover-morph" : "none"}
    >
      <div className={className} data-motion-cover-source={sourceKey} data-motion-cover-id={id}>{children}</div>
    </ViewTransition>
  );
}


export function usePendingCoverSrc(id: string | undefined) {
  return useSyncExternalStore(subscribe, () => selected?.id === id ? selected?.src : undefined, () => undefined);
}
