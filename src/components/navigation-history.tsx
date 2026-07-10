"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const navigationStackKey = `${STORAGE_PREFIX}v1:navigation-stack`;

type NavigationRouter = {
  back: () => void;
  push: (href: string) => void;
  replace: (href: string) => void;
};

type NavigationFrameKind = "detail" | "root" | "search";

type NavigationFrame = {
  href: string;
  id: string;
  kind: NavigationFrameKind;
};

type NavigationCloseAction =
  | { type: "back" }
  | { delta: number; type: "history" }
  | { href: string; type: "push" | "replace" };

export function NavigationHistory() {
  const pathname = usePathname();

  useEffect(() => {
    reconcileNavigationStack(`${pathname}${window.location.search}`);
  }, [pathname]);

  return null;
}

export function pushNavigationFrame(kind: NavigationFrameKind, href: string) {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = getCurrentNavigationPath();
  reconcileNavigationStack(currentPath);
  const stack = readNavigationStack();
  const normalizedHref = normalizeNavigationPath(href);
  const top = stack.at(-1);

  if (top?.href === normalizedHref) {
    top.kind = kind;
    writeNavigationStack(stack);
    return;
  }

  stack.push(createFrame(kind, normalizedHref));
  writeNavigationStack(stack);
}

export function replaceNavigationFrame(kind: NavigationFrameKind, href: string) {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = getCurrentNavigationPath();
  reconcileNavigationStack(currentPath);
  const stack = readNavigationStack();
  const normalizedHref = normalizeNavigationPath(href);
  const top = stack.at(-1);

  if (!top) {
    writeNavigationStack([createFrame(kind, normalizedHref)]);
    return;
  }

  top.href = normalizedHref;
  top.kind = kind;
  writeNavigationStack(stack);
}

export function resetNavigationStackRoot(href?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const rootHref = normalizeNavigationPath(href || getCurrentNavigationPath());
  writeNavigationStack([createFrame("root", rootHref)]);
}

export function resolveSearchCloseAction(): NavigationCloseAction {
  return closeCurrentFrame();
}

export function resolveDetailCloseAction(): NavigationCloseAction {
  return closeCurrentFrame();
}

export function performNavigationClose(
  action: NavigationCloseAction,
  router: NavigationRouter,
) {
  if (action.type === "back") {
    router.back();
    return;
  }

  if (action.type === "history") {
    window.history.go(action.delta);
    return;
  }

  if (action.type === "replace") {
    router.replace(action.href);
    return;
  }

  router.push(action.href);
}

export function noteSearchEntry(origin?: string) {
  if (typeof window === "undefined") {
    return;
  }

  const currentPath = origin || getCurrentNavigationPath();

  if (!isSearchPath(currentPath)) {
    reconcileNavigationStack(currentPath);
  }
}

function closeCurrentFrame(): NavigationCloseAction {
  if (typeof window === "undefined") {
    return { href: "/", type: "replace" };
  }

  const currentPath = getCurrentNavigationPath();
  reconcileNavigationStack(currentPath);
  const stack = readNavigationStack();

  if (stack.length <= 1) {
    writeNavigationStack([createFrame("root", "/")]);
    return { href: "/", type: "replace" };
  }

  stack.pop();
  const target = stack.at(-1) || createFrame("root", "/");
  writeNavigationStack(stack.length ? stack : [target]);

  return { href: target.href, type: "replace" };
}

function reconcileNavigationStack(path: string) {
  const normalizedPath = normalizeNavigationPath(path);

  if (isReviewEditorPath(normalizedPath)) {
    return;
  }

  const stack = ensureStackForPath(readNavigationStack(), normalizedPath);
  const top = stack.at(-1);

  if (top?.href === normalizedPath) {
    writeNavigationStack(stack);
    return;
  }

  const existingIndex = stack.findIndex((frame) => frame.href === normalizedPath);

  if (existingIndex >= 0) {
    writeNavigationStack(stack.slice(0, existingIndex + 1));
    return;
  }

  if (isRootPath(normalizedPath)) {
    writeNavigationStack([createFrame("root", normalizedPath)]);
    return;
  }

  // A server-side canonical-category redirect (e.g. /item/tv/{uuid} ->
  // /item/tv-season/{uuid}, when a uuid was requested under the wrong
  // category segment) lands on a new pathname for the same logical item, not
  // a page the user actually navigated to. Merge it into the current frame
  // instead of stacking a duplicate, so closing doesn't bounce back through
  // the pre-redirect URL.
  if (top && isSameItemRedirect(top.href, normalizedPath)) {
    top.href = normalizedPath;
    writeNavigationStack(stack);
    return;
  }

  stack.push(createFrame(getFrameKind(normalizedPath), normalizedPath));
  writeNavigationStack(stack);
}

function isSameItemRedirect(previousPath: string, nextPath: string) {
  const previousMatch = previousPath.match(/^\/item\/[^/]+\/([^/?#]+)/);
  const nextMatch = nextPath.match(/^\/item\/[^/]+\/([^/?#]+)/);

  return Boolean(
    previousMatch && nextMatch && previousMatch[1] === nextMatch[1],
  );
}

function ensureStackForPath(stack: NavigationFrame[], path: string) {
  const normalizedPath = normalizeNavigationPath(path);

  if (stack.length) {
    return stack;
  }

  if (isRootPath(normalizedPath)) {
    return [createFrame("root", normalizedPath)];
  }

  return [
    createFrame("root", "/"),
    createFrame(getFrameKind(normalizedPath), normalizedPath),
  ];
}

function readNavigationStack() {
  if (typeof window === "undefined") {
    return [] as NavigationFrame[];
  }

  const raw = window.sessionStorage.getItem(navigationStackKey);

  if (!raw) {
    return [];
  }

  try {
    const value = JSON.parse(raw) as NavigationFrame[];

    return Array.isArray(value)
      ? value.filter(
          (frame) =>
            typeof frame?.href === "string" &&
            typeof frame.id === "string" &&
            isNavigationFrameKind(frame.kind),
        )
      : [];
  } catch {
    return [];
  }
}

function writeNavigationStack(stack: NavigationFrame[]) {
  window.sessionStorage.setItem(navigationStackKey, JSON.stringify(stack));
}

function createFrame(kind: NavigationFrameKind, href: string): NavigationFrame {
  return {
    href: normalizeNavigationPath(href),
    id: createFrameId(),
    kind,
  };
}

function createFrameId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getFrameKind(path: string): NavigationFrameKind {
  if (isSearchPath(path)) {
    return "search";
  }

  if (path.startsWith("/item/") || path.startsWith("/collection/")) {
    return "detail";
  }

  return "root";
}

function isReviewEditorPath(path: string) {
  return /^\/item\/[^/]+\/[^/]+\/review(?:[?#]|$)/.test(path);
}

function isNavigationFrameKind(value: unknown): value is NavigationFrameKind {
  return value === "detail" || value === "root" || value === "search";
}

function isSearchPath(path: string) {
  return path.startsWith("/search");
}

function isRootPath(path: string) {
  return (
    !path.startsWith("/collection/") &&
    !path.startsWith("/item/") &&
    !path.startsWith("/search")
  );
}

function normalizeNavigationPath(path: string) {
  const url = new URL(path, window.location.origin);

  return `${url.pathname}${url.search}${url.hash}`;
}

function getCurrentNavigationPath() {
  return `${window.location.pathname}${window.location.search}`;
}
