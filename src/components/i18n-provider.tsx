"use client";

import { createContext, type ReactNode } from "react";
import { type Messages, type Locale } from "@/i18n/config";

type I18nContextValue = {
  locale: Locale;
  t: (key: string) => string;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: "zh-Hans" as Locale,
  t: () => "",
});

export function I18nProvider({
  children,
  locale,
  messages,
}: {
  children: ReactNode;
  locale: Locale;
  messages: Messages;
}) {
  function t(key: string): string {
    const parts = key.split(".");
    let current: unknown = messages;

    for (const part of parts) {
      if (current == null || typeof current !== "object") {
        return key;
      }

      current = (current as Record<string, unknown>)[part];
    }

    return typeof current === "string" ? current : key;
  }

  return (
    <I18nContext.Provider value={{ locale, t }}>
      {children}
    </I18nContext.Provider>
  );
}
