import { siteConfig } from "@/site.config";
import { STORAGE_PREFIX } from "@/lib/runtime-ids";

export const THEME_COLOR_KEY = `${STORAGE_PREFIX}v1:appearance:color`;
export const THEME_COLOR_EVENT = "app:theme-color";
export const THEME_MODE_KEY = `${STORAGE_PREFIX}v1:appearance:mode`;
export const THEME_MODE_EVENT = "app:theme-mode";

export type ThemeColorId = "amber" | "indigo" | "rose" | "sage" | "slate";
export type ThemeMode = "dark" | "light" | "system";

export type ThemeColor = {
  id: ThemeColorId;
  label: string;
  primary: string;
  primaryHover: string;
};

/** Drives the OS status bar so it matches the page rather than the brand
 * color, which leaves a hard seam above the top bar. Must stay in sync with
 * `--background` in globals.css. */
export const pageBackgroundColors = {
  dark: "#101214",
  light: "#f9f9fc",
};

export const themeColors: ThemeColor[] = [
  { id: "slate", label: "石墨", primary: "#333e50", primaryHover: "#273142" },
  { id: "rose", label: "蔷薇", primary: "#8f4e5d", primaryHover: "#7a4651" },
  { id: "sage", label: "鼠尾草", primary: "#4c635b", primaryHover: "#3d514a" },
  { id: "amber", label: "琥珀", primary: "#9f6f2e", primaryHover: "#84591e" },
  { id: "indigo", label: "靛蓝", primary: "#5867a8", primaryHover: "#465489" },
];

const defaultThemeColor =
  themeColors.find((color) => color.id === siteConfig.themeColorId) ||
  themeColors[0];

/** The deployment's configured default theme color, used before the visitor
 * has made their own choice (or after they reset it). */
export function getDefaultThemeColor(): ThemeColor {
  return defaultThemeColor;
}

export function getThemeColor(id: string | null | undefined) {
  return themeColors.find((color) => color.id === id) || defaultThemeColor;
}

export function getThemeMode(value: string | null | undefined): ThemeMode {
  if (value === "dark" || value === "light") {
    return value;
  }

  return "system";
}

export function resolveThemeMode(mode: ThemeMode, prefersDark: boolean) {
  return mode === "system" ? (prefersDark ? "dark" : "light") : mode;
}
