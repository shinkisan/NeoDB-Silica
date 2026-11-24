"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, type ComponentPropsWithRef } from "react";

function prepareImage(image: HTMLImageElement | null) {
  if (!image) return;
  if (image.complete && image.naturalWidth > 0) {
    image.removeAttribute("data-cover-pending");
  } else {
    image.setAttribute("data-cover-pending", "");
  }
}

function revealImage(image: HTMLImageElement) {
  if (!image.hasAttribute("data-cover-pending")) return;
  image.removeAttribute("data-cover-pending");
  image.classList.add("cover-reveal");
}

export function FadeImage({ alt, onError, onLoad, ...props }: ImageProps) {
  return (
    <Image
      {...props}
      alt={alt}
      ref={prepareImage}
      onError={(event) => {
        event.currentTarget.removeAttribute("data-cover-pending");
        onError?.(event);
      }}
      onLoad={(event) => {
        revealImage(event.currentTarget);
        onLoad?.(event);
      }}
    />
  );
}

export function FadeNativeImage({ alt = "", ref, onError, onLoad, ...props }: ComponentPropsWithRef<"img">) {
  const assignImage = useCallback((image: HTMLImageElement | null) => {
    prepareImage(image);
    if (typeof ref === "function") return ref(image);
    if (ref) ref.current = image;
  }, [ref]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      {...props}
      alt={alt}
      ref={assignImage}
      onError={(event) => {
        event.currentTarget.removeAttribute("data-cover-pending");
        onError?.(event);
      }}
      onLoad={(event) => {
        revealImage(event.currentTarget);
        onLoad?.(event);
      }}
    />
  );
}
