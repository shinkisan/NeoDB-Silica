import { NextResponse } from "next/server";
import { type Locale, locales } from "@/i18n/config";
import { resolveRequestLocale } from "@/i18n/resolve-locale";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type SteamMovie = {
  highlight?: boolean;
  hls_h264?: string;
  thumbnail?: string;
};

type SteamAppDetailsResponse = Record<
  string,
  {
    data?: {
      movies?: SteamMovie[];
    };
    success?: boolean;
  }
>;

const STEAM_APP_ID_PATTERN = /^\d{1,12}$/;
const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "steam:trailer",
    limit: 30,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "rate_limited" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const searchParams = new URL(request.url).searchParams;
  const appId = searchParams.get("appId")?.trim();

  if (!appId || !STEAM_APP_ID_PATTERN.test(appId)) {
    return NextResponse.json({ error: "invalid_app_id" }, { status: 400 });
  }

  configureServerFetchProxy();

  try {
    const requestedLocale = searchParams.get("locale")?.trim();
    const locale =
      requestedLocale &&
      (locales as readonly string[]).includes(requestedLocale)
        ? (requestedLocale as Locale)
        : await resolveRequestLocale();
    const params = new URLSearchParams({
      appids: appId,
      cc: locale === "zh-Hant" ? "TW" : locale === "zh-Hans" ? "CN" : "US",
      l:
        locale === "zh-Hant"
          ? "tchinese"
          : locale === "zh-Hans"
            ? "schinese"
            : "english",
    });
    const response = await fetchWithTimeout(
      `https://store.steampowered.com/api/appdetails?${params.toString()}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 60 * 24 },
      },
      8_000,
    );

    if (!response.ok) {
      console.error("[steam trailer] app details request failed", {
        appId,
        status: response.status,
      });
      return NextResponse.json({ error: "steam_unavailable" }, { status: 502 });
    }

    const payload = (await response.json()) as SteamAppDetailsResponse;
    const movies = payload[appId]?.data?.movies || [];
    const trailer =
      movies.find((movie) => movie.highlight && isSteamHlsUrl(movie.hls_h264)) ||
      movies.find((movie) => isSteamHlsUrl(movie.hls_h264));

    if (!trailer?.hls_h264) {
      return NextResponse.json({ error: "trailer_not_found" }, { status: 404 });
    }

    return NextResponse.json(
      {
        posterUrl: isSteamImageUrl(trailer.thumbnail)
          ? trailer.thumbnail
          : null,
        streamUrl: trailer.hls_h264,
      },
      { headers: { "Cache-Control": CACHE_CONTROL } },
    );
  } catch (error) {
    console.error("[steam trailer] request failed", { appId, error });
    return NextResponse.json({ error: "steam_unavailable" }, { status: 502 });
  }
}

function isSteamHlsUrl(value: string | undefined): value is string {
  return isAllowedSteamMediaUrl(value, ".m3u8");
}

function isSteamImageUrl(value: string | undefined): value is string {
  return isAllowedSteamMediaUrl(value);
}

function isAllowedSteamMediaUrl(value: string | undefined, suffix?: string) {
  if (!value) {
    return false;
  }

  try {
    const url = new URL(value);
    const isSteamCdn =
      url.hostname === "cdn.akamai.steamstatic.com" ||
      url.hostname.endsWith(".steamstatic.com") ||
      url.hostname.endsWith(".steamcontent.com");

    return (
      url.protocol === "https:" &&
      isSteamCdn &&
      (!suffix || url.pathname.endsWith(suffix))
    );
  } catch {
    return false;
  }
}
