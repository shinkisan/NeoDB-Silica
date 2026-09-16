"use client";

import { useEffect } from "react";
import { APP_RESET_EVENT } from "@/lib/app-reset";
import {
  getThemeMode,
  getThemeColor,
  pageBackgroundColors,
  resolveThemeMode,
  THEME_COLOR_EVENT,
  THEME_COLOR_KEY,
  THEME_MODE_EVENT,
  THEME_MODE_KEY,
} from "@/lib/theme";

export function ThemeController() {
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    applyThemeColor(window.localStorage.getItem(THEME_COLOR_KEY));
    let activeStatusBarColor = applyThemeMode(
      getThemeMode(window.localStorage.getItem(THEME_MODE_KEY)),
      mediaQuery.matches,
    );

    function syncThemeColor(event: Event) {
      applyThemeColor((event as CustomEvent<string>).detail);
    }

    function syncThemeMode(event: Event) {
      activeStatusBarColor = applyThemeMode(
        getThemeMode((event as CustomEvent<string>).detail),
        mediaQuery.matches,
      );
    }

    function syncSystemTheme(event: MediaQueryListEvent) {
      activeStatusBarColor = applyThemeMode(
        getThemeMode(window.localStorage.getItem(THEME_MODE_KEY)),
        event.matches,
      );
    }

    function syncAppReset() {
      applyThemeColor(null);
      activeStatusBarColor = applyThemeMode(
        getThemeMode(null),
        mediaQuery.matches,
      );
    }

    const headObserver = new MutationObserver(() => {
      updateThemeColorMeta(activeStatusBarColor);
    });

    headObserver.observe(document.head, {
      attributeFilter: ["content", "name"],
      attributes: true,
      childList: true,
      subtree: true,
    });

    window.addEventListener(THEME_COLOR_EVENT, syncThemeColor);
    window.addEventListener(THEME_MODE_EVENT, syncThemeMode);
    window.addEventListener(APP_RESET_EVENT, syncAppReset);
    mediaQuery.addEventListener("change", syncSystemTheme);

    return () => {
      window.removeEventListener(THEME_COLOR_EVENT, syncThemeColor);
      window.removeEventListener(THEME_MODE_EVENT, syncThemeMode);
      window.removeEventListener(APP_RESET_EVENT, syncAppReset);
      mediaQuery.removeEventListener("change", syncSystemTheme);
      headObserver.disconnect();
    };
  }, []);

  return null;
}

function applyThemeColor(id: string | null | undefined) {
  const themeColor = getThemeColor(id);

  document.documentElement.style.setProperty(
    "--theme-primary",
    themeColor.primary,
  );
  document.documentElement.style.setProperty(
    "--theme-primary-hover",
    themeColor.primaryHover,
  );
}

function applyThemeMode(mode: ReturnType<typeof getThemeMode>, prefersDark: boolean) {
  const resolvedMode = resolveThemeMode(mode, prefersDark);

  document.documentElement.dataset.theme = resolvedMode;
  document.documentElement.dataset.themeMode = mode;
  updateThemeColorMeta(pageBackgroundColors[resolvedMode]);

  return pageBackgroundColors[resolvedMode];
}

function updateThemeColorMeta(color: string) {
  const selector = 'meta[name="theme-color"]';
  const metas = Array.from(
    document.head.querySelectorAll<HTMLMetaElement>(selector),
  );

  if (!metas.length) {
    const meta = document.createElement("meta");

    meta.name = "theme-color";
    meta.content = color;
    document.head.appendChild(meta);
    return;
  }

  for (const meta of metas) {
    if (meta.content !== color) {
      meta.content = color;
    }
  }
}
