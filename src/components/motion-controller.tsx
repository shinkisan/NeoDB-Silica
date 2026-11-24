"use client";

import { selectTransitionCover } from "@/components/cover-transition";
import { rememberMotionTrigger } from "@/lib/motion";
import { useEffect } from "react";
import { endPressFeedback, startPressFeedback } from "@/components/press-surface";

let clearDirectionTimer = 0;

function setNavigationDirection(direction: "back" | "none") {
  const root = document.documentElement;
  root.dataset.navDir = direction;
  window.clearTimeout(clearDirectionTimer);
  // Clear the marker even when navigation is cancelled or no transition starts.
  clearDirectionTimer = window.setTimeout(() => delete root.dataset.navDir, 1600);
}

export function markMotionBack() {
  setNavigationDirection("back");
}

export function MotionController() {
  useEffect(() => {
    const root = document.documentElement;

    function onPopState(event: PopStateEvent) {
      setNavigationDirection(event.hasUAVisualTransition ? "none" : "back");
    }

    function onForwardNavigation(event: MouseEvent) {
      rememberMotionTrigger(event.target);
      if ((event.target as Element).closest?.("a[href], [role=link]")) delete root.dataset.navDir;
      if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        selectTransitionCover(event.target);
      }
    }

    function onLinkKey(event: KeyboardEvent) {
      if ((event.key === "Enter" || event.key === " ") && (event.target as Element).closest?.("[role=link]")) {
        selectTransitionCover(event.target);
      }
    }

    window.addEventListener("keydown", onLinkKey, true);
    window.addEventListener("popstate", onPopState, true);
    window.addEventListener("click", onForwardNavigation, true);
    return () => {
      window.removeEventListener("keydown", onLinkKey, true);
      window.removeEventListener("popstate", onPopState, true);
      window.removeEventListener("click", onForwardNavigation, true);
      window.clearTimeout(clearDirectionTimer);
      delete root.dataset.navDir;
    };
  }, []);

  useEffect(() => {
    document.addEventListener("pointerdown", startPressFeedback, true);
    window.addEventListener("pointerup", endPressFeedback, true);
    window.addEventListener("pointercancel", endPressFeedback, true);
    return () => {
      document.removeEventListener("pointerdown", startPressFeedback, true);
      window.removeEventListener("pointerup", endPressFeedback, true);
      window.removeEventListener("pointercancel", endPressFeedback, true);
    };
  }, []);
  return null;
}
