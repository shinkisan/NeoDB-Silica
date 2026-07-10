"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/use-t";
import { Dropdown, type DropdownOption } from "@/components/dropdown";
import { APP_RESET_EVENT } from "@/lib/app-reset";
import {
  getDefaultThemeColor,
  getThemeMode,
  resolveThemeMode,
  THEME_COLOR_EVENT,
  THEME_COLOR_KEY,
  THEME_MODE_EVENT,
  THEME_MODE_KEY,
  themeColors,
} from "@/lib/theme";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

const MODE_KEY = THEME_MODE_KEY;
const COLOR_KEY = THEME_COLOR_KEY;
const LANG_KEY = `${STORAGE_PREFIX}v1:lang`;

const defaultThemeColorId = getDefaultThemeColor().id;

export function NightModeSelect() {
  const t = useT();
  const [value, setValue] = useStoredOption(MODE_KEY, "system");
  const options: DropdownOption[] = [
    { id: "system", label: t("profile.appearance.mode.system") },
    { id: "light", label: t("profile.appearance.mode.light") },
    { id: "dark", label: t("profile.appearance.mode.dark") },
  ];

  return (
    <Dropdown
      onChange={setValue}
      options={options}
      value={value}
    />
  );
}

export function ThemeColorSelect() {
  const t = useT();
  const [value, setValue] = useStoredOption(COLOR_KEY, defaultThemeColorId);
  const options: DropdownOption[] = themeColors.map((color) => ({
    color: color.primary,
    id: color.id,
    label: t(`profile.appearance.themeColor.${color.id}`),
  }));

  return (
    <Dropdown
      onChange={setValue}
      options={options}
      showColor
      value={value}
    />
  );
}

export function LanguageSelect() {
  const t = useT();
  const [value, setValue] = useStoredOption(LANG_KEY, "system");
  const options: DropdownOption[] = [
    { id: "system", label: t("profile.appearance.language.system") },
    { id: "zh-Hant", label: "正體中文" },
    { id: "zh-Hans", label: "简体中文" },
    { id: "en", label: "English" },
  ];

  return (
    <Dropdown
      onChange={setValue}
      options={options}
      value={value}
    />
  );
}

function useStoredOption(key: string, fallback: string) {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    function syncValueFromStorage() {
      setValue(window.localStorage.getItem(key) || fallback);
    }

    window.queueMicrotask(syncValueFromStorage);
    window.addEventListener(APP_RESET_EVENT, syncValueFromStorage);

    return () => {
      window.removeEventListener(APP_RESET_EVENT, syncValueFromStorage);
    };
  }, [fallback, key]);

  function updateValue(nextValue: string) {
    setValue(nextValue);
    window.localStorage.setItem(key, nextValue);

    if (key === THEME_COLOR_KEY) {
      window.dispatchEvent(
        new CustomEvent(THEME_COLOR_EVENT, { detail: nextValue }),
      );
    }

    if (key === THEME_MODE_KEY) {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const mode = getThemeMode(nextValue);
      document.documentElement.dataset.theme = resolveThemeMode(
        mode,
        mediaQuery.matches,
      );
      document.documentElement.dataset.themeMode = mode;
      window.dispatchEvent(
        new CustomEvent(THEME_MODE_EVENT, { detail: nextValue }),
      );
    }

    if (key === LANG_KEY) {
      if (nextValue === "system") {
        document.cookie = "NEXT_LOCALE=; max-age=0; path=/";
      } else {
        document.cookie = `NEXT_LOCALE=${nextValue}; max-age=31536000; path=/`;
      }

      clearItemCaches();
      window.location.reload();
    }
  }

  return [value, updateValue] as const;
}

function clearItemCaches() {
  const itemPrefixes = [
    `${STORAGE_PREFIX}v1:neodb:trending:`,
    `${STORAGE_PREFIX}v1:profile:calendar:`,
  ];

  for (let i = window.localStorage.length - 1; i >= 0; i--) {
    const key = window.localStorage.key(i);

    if (key && itemPrefixes.some((prefix) => key.startsWith(prefix))) {
      window.localStorage.removeItem(key);
    }
  }

  window.sessionStorage.removeItem(`${STORAGE_PREFIX}v1:home:category`);
  window.sessionStorage.removeItem(`${STORAGE_PREFIX}v1:home:restore`);
  window.sessionStorage.removeItem(`${STORAGE_PREFIX}v1:home:leaving`);
}
