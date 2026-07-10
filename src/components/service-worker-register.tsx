"use client";

import { useEffect } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

declare global {
  interface Window {
    __appInstallPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const INSTALL_PROMPT_EVENT = "app:install-prompt";

export function ServiceWorkerRegister() {
  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      window.__appInstallPrompt = event as BeforeInstallPromptEvent;
      window.dispatchEvent(new Event(INSTALL_PROMPT_EVENT));
    }

    function handleInstalled() {
      window.__appInstallPrompt = null;
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
      // Dev mode runs without the service worker; drop every cache it may
      // have left behind (current and legacy names alike).
      window.caches?.keys().then((keys) => {
        keys.forEach((key) => {
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
