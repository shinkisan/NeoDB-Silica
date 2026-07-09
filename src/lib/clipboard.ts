"use client";

export async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall back to a DOM copy path for HTTP LAN testing and stricter browsers.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("copy failed");
  }
}

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export async function shareContent(data: ShareData): Promise<boolean> {
  if (
    navigator.share &&
    window.isSecureContext &&
    navigator.canShare?.(data)
  ) {
    try {
      await navigator.share(data);
      return true;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return false;
      }
    }
  }

  await copyText(data.url || window.location.href);
  return false;
}
