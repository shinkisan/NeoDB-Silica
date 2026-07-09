"use client";

import { useEffect, useState } from "react";
import { useT } from "@/components/use-t";
import { showToast } from "@/components/app-toast";
import { INSTALL_PROMPT_EVENT } from "@/components/service-worker-register";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

export function InstallAppButton() {
  const t = useT();
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const navigatorStandalone =
      "standalone" in window.navigator &&
      Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);

    const installStateTimer = window.setTimeout(() => {
      setIsInstalled(standalone || navigatorStandalone);
    }, 0);

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    }

    function syncInstallPrompt() {
      setInstallPrompt(window.__bieluInstallPrompt || null);
    }

    function handleInstalled() {
      setIsInstalled(true);
      setInstallPrompt(null);
      showToast(t("profile.install.success"));
    }

    syncInstallPrompt();
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener(INSTALL_PROMPT_EVENT, syncInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.clearTimeout(installStateTimer);
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener(INSTALL_PROMPT_EVENT, syncInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, [t]);

  async function installApp() {
    if (isInstalled) {
      showToast(t("profile.install.success"));
      return;
    }

    if (!installPrompt) {
      showToast(getInstallHint(t));
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;

    if (choice.outcome === "accepted") {
      window.__bieluInstallPrompt = null;
      setInstallPrompt(null);
    }
  }

  return (
    <button
      className="inline-flex h-9 items-center rounded-full border border-white/70 bg-white/45 px-3 text-xs font-bold text-[#1a1c1e] shadow-sm transition hover:bg-white/75 active:scale-95"
      onClick={installApp}
      type="button"
    >
      {isInstalled ? t("profile.install.installed") : t("profile.install.install")}
    </button>
  );
}

function getInstallHint(t: ReturnType<typeof useT>) {
  if (process.env.NODE_ENV !== "production") {
    return t("profile.install.hintDev");
  }

  const isAppleTouchBrowser =
    /iPad|iPhone|iPod/.test(window.navigator.userAgent) ||
    (window.navigator.platform === "MacIntel" &&
      window.navigator.maxTouchPoints > 1);
  const isSafari =
    /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(
      window.navigator.userAgent,
    );

  if (isAppleTouchBrowser && isSafari) {
    return t("profile.install.hintSafariIos");
  }

  if (isSafari) {
    return t("profile.install.hintSafari");
  }

  return t("profile.install.hintGeneric");
}
