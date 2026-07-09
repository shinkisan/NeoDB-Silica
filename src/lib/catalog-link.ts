const DETAIL_PATH_PATTERNS = [
  { appCategory: "tv-season", segments: ["tv", "season"] },
  { appCategory: "tv-episode", segments: ["tv", "episode"] },
  { appCategory: "podcast-episode", segments: ["podcast", "episode"] },
  { appCategory: "performance-production", segments: ["performance", "production"] },
  { appCategory: "book", segments: ["book"] },
  { appCategory: "movie", segments: ["movie"] },
  { appCategory: "tv", segments: ["tv"] },
  { appCategory: "music", segments: ["music"] },
  { appCategory: "music", segments: ["album"] },
  { appCategory: "game", segments: ["game"] },
  { appCategory: "podcast", segments: ["podcast"] },
  { appCategory: "performance", segments: ["performance"] },
];

const NEODB_HOST_PATTERN = /(^|\.)neodb\./i;

export function parseNeodbDetailPath(value: string) {
  try {
    const parsed = new URL(value.trim());

    if (!NEODB_HOST_PATTERN.test(parsed.hostname)) {
      return null;
    }

    return detailPathFromSegments(parsed.pathname.split("/").filter(Boolean));
  } catch {
    return null;
  }
}

export function parseCatalogDetailPath(value: string) {
  try {
    const parsed = new URL(value.trim(), "https://neodb.local");

    return detailPathFromSegments(parsed.pathname.split("/").filter(Boolean));
  } catch {
    return null;
  }
}

function detailPathFromSegments(segments: string[]) {
  const apiIndex = segments.indexOf("api");
  const detailSegments = apiIndex >= 0 ? segments.slice(apiIndex + 1) : segments;

  for (let startIndex = 0; startIndex < detailSegments.length; startIndex += 1) {
    for (const pattern of DETAIL_PATH_PATTERNS) {
      const matches = pattern.segments.every(
        (segment, segmentIndex) =>
          detailSegments[startIndex + segmentIndex] === segment,
      );

      if (!matches) {
        continue;
      }

      const uuid = detailSegments[startIndex + pattern.segments.length];

      if (!uuid) {
        continue;
      }

      return `/item/${pattern.appCategory}/${encodeURIComponent(uuid)}`;
    }
  }

  return null;
}
