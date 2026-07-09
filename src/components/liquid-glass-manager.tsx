"use client";

import { useEffect } from "react";
import { getDisplacementFilter } from "@/lib/liquid-glass";

// App-level driver for the liquid-glass effect. Any element with the
// `liquid-glass` class is given a size-aware edge-refraction `backdrop-filter`
// (see src/lib/liquid-glass.ts), recomputed on resize. Per-surface tuning comes
// from optional data attributes:
//   data-lg-depth, data-lg-strength, data-lg-cab (chromatic aberration),
//   data-lg-blur, data-lg-brightness, data-lg-saturate
// Browsers without url() backdrop filters (Safari/Firefox) keep the CSS blur
// fallback defined on `.liquid-glass`.

let cachedSupport: boolean | null = null;

function supportsBackdropFilterUrl() {
  if (cachedSupport !== null) return cachedSupport;
  if (typeof document === "undefined") return false;
  const probe = document.createElement("div");
  probe.style.cssText = "backdrop-filter: url(#test)";
  cachedSupport =
    probe.style.backdropFilter === "url(#test)" ||
    probe.style.backdropFilter === 'url("#test")';
  return cachedSupport;
}

function readNumber(value: string | undefined, fallback: number) {
  if (value == null) return fallback;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function LiquidGlassManager() {
  useEffect(() => {
    if (!supportsBackdropFilterUrl()) return;

    const resizeObservers = new Map<HTMLElement, ResizeObserver>();

    function apply(element: HTMLElement) {
      const rect = element.getBoundingClientRect();
      const width = Math.round(rect.width);
      const height = Math.round(rect.height);
      if (!width || !height) return;

      const styles = getComputedStyle(element);
      const radius = Number.parseFloat(styles.borderRadius) || 0;
      const blur = readNumber(element.dataset.lgBlur, 1);
      const brightness = readNumber(element.dataset.lgBrightness, 1.06);
      const saturate = readNumber(element.dataset.lgSaturate, 1.5);

      const filter = getDisplacementFilter({
        width,
        height,
        radius,
        depth: readNumber(element.dataset.lgDepth, 6),
        strength: readNumber(element.dataset.lgStrength, 44),
        chromaticAberration: readNumber(element.dataset.lgCab, 3),
      });
      const value = `blur(${blur / 2}px) url('${filter}') blur(${blur}px) brightness(${brightness}) saturate(${saturate})`;
      element.style.backdropFilter = value;
      element.style.setProperty("-webkit-backdrop-filter", value);
    }

    function attach(element: HTMLElement) {
      if (resizeObservers.has(element)) return;
      apply(element);
      const observer = new ResizeObserver(() => apply(element));
      observer.observe(element);
      resizeObservers.set(element, observer);
    }

    function detach(element: HTMLElement) {
      const observer = resizeObservers.get(element);
      if (!observer) return;
      observer.disconnect();
      resizeObservers.delete(element);
    }

    document
      .querySelectorAll<HTMLElement>(".liquid-glass")
      .forEach(attach);

    const mutationObserver = new MutationObserver((records) => {
      for (const record of records) {
        record.addedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains("liquid-glass")) attach(node);
          node
            .querySelectorAll<HTMLElement>(".liquid-glass")
            .forEach(attach);
        });
        record.removedNodes.forEach((node) => {
          if (!(node instanceof HTMLElement)) return;
          if (node.classList.contains("liquid-glass")) detach(node);
          node
            .querySelectorAll<HTMLElement>(".liquid-glass")
            .forEach(detach);
        });
      }
    });
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    return () => {
      mutationObserver.disconnect();
      resizeObservers.forEach((observer) => observer.disconnect());
      resizeObservers.clear();
    };
  }, []);

  return null;
}
