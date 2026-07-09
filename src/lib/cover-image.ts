import { getConfiguredNeodbHostname } from "@/lib/neodb-instance";

const COVER_IMAGE_PATH_PREFIXES = ["/m/", "/media/"];

export function getCoverProxySrc(
  src: string | null | undefined,
  isEnabled = true,
) {
  if (!isEnabled || !src || !isPotentialCoverImageUrl(src)) {
    return src || null;
  }

  return `/api/image/cover?url=${encodeURIComponent(src)}`;
}

export function isCoverImageProxyEnabled() {
  return process.env.COVER_IMAGE_PROXY !== "0";
}

export function isSupportedCoverImageUrl(src: string) {
  try {
    const url = new URL(src);

    const supportedHosts = new Set([
      "neodb.social",
      getConfiguredNeodbHostname(),
    ]);

    if (
      !["http:", "https:"].includes(url.protocol) ||
      !supportedHosts.has(url.hostname)
    ) {
      return false;
    }

    return isSupportedCoverImagePath(url);
  } catch {
    return false;
  }
}

function isPotentialCoverImageUrl(src: string) {
  try {
    const url = new URL(src);

    return (
      ["http:", "https:"].includes(url.protocol) &&
      (url.hostname === getConfiguredNeodbHostname() ||
        url.hostname === "neodb.social" ||
        url.hostname.startsWith("neodb.")) &&
      isSupportedCoverImagePath(url)
    );
  } catch {
    return false;
  }
}

function isSupportedCoverImagePath(url: URL) {
  return COVER_IMAGE_PATH_PREFIXES.some((prefix) =>
    url.pathname.startsWith(prefix),
  );
}
