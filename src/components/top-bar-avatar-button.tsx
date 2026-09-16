"use client";

import { useState, type ReactNode } from "react";
import { registerLiquidGlass } from "@/components/liquid-glass-manager";
import topBarStyles from "@/components/floating-top-bar.module.css";

export function TopBarAvatarButton({
  alt,
  fallback,
  isVisible,
  label,
  src,
}: {
  alt: string;
  fallback: ReactNode;
  isVisible: boolean;
  label: string;
  src?: string | null;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);

  return (
    <button
      aria-hidden={!isVisible}
      aria-label={label}
      className={`${topBarStyles.glassIsland} liquid-glass absolute left-1/2 -translate-x-1/2 rounded-full border border-white/50 transition-[opacity,transform,scale] duration-200 ease-out press-icon motion-reduce:transition-none ${
        isVisible
          ? "translate-y-0 opacity-100"
          : "pointer-events-none -translate-y-2 opacity-0"
      }`}
      data-lg-cab="2"
      data-lg-depth="4"
      data-lg-strength="34"
      onClick={() => {
        window.scrollTo({
          behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
          top: 0,
        });
      }}
      ref={registerLiquidGlass}
      tabIndex={isVisible ? 0 : -1}
      type="button"
    >
      <span className="grid size-10 place-items-center overflow-hidden rounded-full bg-[#dde3eb] text-xs font-bold text-[#333e50]">
        {showImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            alt={alt}
            className="size-full object-cover"
            key={src}
            onError={() => setFailedSrc(src || null)}
            src={src || ""}
          />
        ) : (
          fallback
        )}
      </span>
    </button>
  );
}
