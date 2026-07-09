"use client";

import { useContext, useEffect, useState } from "react";
import { showToast } from "@/components/app-toast";
import { useFeatureFlags } from "@/components/feature-flags";
import { I18nContext } from "@/components/i18n-provider";
import {
  readCommentTranslation,
  writeCommentTranslation,
} from "@/lib/comment-translation-cache";

export function useCommentTranslation(text: string) {
  const { locale, t } = useContext(I18nContext);
  const [translatedText, setTranslatedText] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    window.queueMicrotask(() => {
      setTranslatedText("");
      setIsExpanded(false);
      setIsLoading(false);
    });
  }, [locale, text]);

  async function toggleTranslation() {
    if (isLoading) {
      return;
    }

    if (translatedText) {
      setIsExpanded((current) => !current);
      return;
    }

    const cached = readCommentTranslation(text, locale);

    if (cached) {
      setTranslatedText(cached);
      setIsExpanded(true);
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/translate", {
        body: JSON.stringify({
          targetLanguage: locale,
          text,
        }),
        headers: { "Content-Type": "application/json" },
        method: "POST",
      });
      const payload = (await response.json().catch(() => null)) as {
        translatedText?: string;
      } | null;

      if (!response.ok || !payload?.translatedText) {
        throw new Error("Translation failed");
      }

      writeCommentTranslation(text, locale, payload.translatedText);
      setTranslatedText(payload.translatedText);
      setIsExpanded(true);
    } catch {
      showToast(t("community.translationUnavailable"), "error");
    } finally {
      setIsLoading(false);
    }
  }

  return {
    isExpanded,
    isLoading,
    toggleTranslation,
    translatedText,
  };
}

export function CommentTranslationButton({
  isExpanded,
  isLoading,
  onClick,
}: {
  isExpanded: boolean;
  isLoading: boolean;
  onClick: () => void;
}) {
  const { t } = useContext(I18nContext);
  const { translate: translateEnabled } = useFeatureFlags();

  if (!translateEnabled) {
    return null;
  }

  return (
    <button
      aria-label={t("community.translate")}
      aria-pressed={isExpanded}
      className={`grid size-8 cursor-pointer place-items-center rounded-full transition hover:bg-white/70 hover:text-[var(--foreground)] active:scale-95 disabled:cursor-wait ${
        isExpanded ? "text-[var(--foreground)]" : "text-[#75777d]"
      }`}
      disabled={isLoading}
      onClick={onClick}
      title={t("community.translate")}
      type="button"
    >
      <TranslateIcon isLoading={isLoading} />
    </button>
  );
}

function TranslateIcon({ isLoading }: { isLoading: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-[1.125rem] ${isLoading ? "animate-pulse" : ""}`}
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="m12.87 15.07-2.54-2.51.03-.03A17.4 17.4 0 0 0 14.07 6H17V4h-7V2H8v2H1v1.99h11.17A16.6 16.6 0 0 1 9 11.35 14.6 14.6 0 0 1 6.69 8h-2a17.9 17.9 0 0 0 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04ZM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12Zm-2.62 7 1.62-4.33L19.12 17h-3.24Z" />
    </svg>
  );
}
