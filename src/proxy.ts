import { NextResponse, type NextRequest } from "next/server";

const ABOUT_LOCALE_HEADER = "x-app-about-locale";

export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  requestHeaders.set(
    ABOUT_LOCALE_HEADER,
    request.nextUrl.pathname.startsWith("/en/")
      ? "en"
      : request.nextUrl.pathname.startsWith("/zh-Hant/")
        ? "zh-Hant"
        : "zh-Hans",
  );

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/about", "/en/about", "/zh-Hant/about"],
};
