"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __bieluInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const INSTALL_PROMPT_EVENT = "bielu:install-prompt";

export function ServiceWorkerRegister() {
  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      window.__bieluInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    }

    function handleInstalled() {
      window.__bieluInstallPrompt = null;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (!("serviceWorker" in navigator)) {
      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    if (process.env.NODE_ENV !== "production") {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => {
          registration.unregister();
        });
      });
      window.caches?.keys().then((keys) => {
        keys
          .filter((key) => key.startsWith("bielu-"))
          .forEach((key) => {
            window.caches.delete(key);
          });
      });
      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    const isLocalhost = ["localhost", "127.0.0.1", "[::1]"].includes(
      window.location.hostname,
    );

    if (window.location.protocol !== "https:" && !isLocalhost) {
      return () => {
        window.removeEventListener(
          "beforeinstallprompt",
          handleBeforeInstallPrompt,
        );
        window.removeEventListener("appinstalled", handleInstalled);
      };
    }

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Static caching is an enhancement; app networking should not depend on it.
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  return null;
}
