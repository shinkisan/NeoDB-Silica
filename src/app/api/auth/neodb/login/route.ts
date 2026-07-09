import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  authCookieOptions,
  OAUTH_COOKIE,
  sealCookie,
  type NeodbOauthCookie,
} from "@/lib/neodb-auth";
import { getConfiguredNeodbAuthInstance } from "@/lib/neodb-instance";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";
import { siteConfig } from "@/site.config";

type AppRegistration = {
  client_id?: string;
  client_secret?: string;
};

export async function GET(request: NextRequest) {
  configureServerFetchProxy();

  const instance = getNeodbAuthBaseUrl();
  const configuredOrigin = getConfiguredPublicOrigin();

  // The redirect_uri registered with the NeoDB instance must come from a
  // trusted, deployer-configured origin in production — falling back to the
  // request's own Host header (below, via getRequestOrigin) is only safe in
  // development, where a spoofed Host header can't reach a real deployment.
  // Refuse rather than silently trusting it once this is live.
  if (process.env.NODE_ENV === "production" && !configuredOrigin) {
    console.error(
      "[neodb-auth] Refusing to start login: set NEODB_REDIRECT_ORIGIN or " +
        "SITE_PUBLIC_ORIGIN in production so the OAuth redirect_uri isn't " +
        "derived from the request's Host header.",
    );
    return NextResponse.redirect(
      new URL("/profile?auth=misconfigured", request.url),
    );
  }

  const requestOrigin = getRequestOrigin(request);
  const origin =
    configuredOrigin &&
    shouldUseConfiguredOrigin(configuredOrigin, requestOrigin) &&
    !isSameApexDomain(configuredOrigin, requestOrigin)
      ? configuredOrigin
      : requestOrigin;

  if (origin !== requestOrigin) {
    return NextResponse.redirect(new URL("/api/auth/neodb/login", origin));
  }

  const redirectUri = new URL("/api/auth/neodb/callback", origin).toString();

  let appResponse: Response;

  try {
    appResponse = await fetchWithTimeout(`${instance}/api/v1/apps`, {
      body: new URLSearchParams({
        client_name: siteConfig.name,
        redirect_uris: redirectUri,
        scopes: "read write",
        website: origin,
      }),
      method: "POST",
    }, 8_000);
  } catch (error) {
    logAuthError("app_registration_fetch_failed", error);
    return NextResponse.redirect(
      new URL("/profile?auth=app_registration_fetch_failed", request.url),
    );
  }

  if (!appResponse.ok) {
    return NextResponse.redirect(
      new URL("/profile?auth=app_registration_failed", request.url),
    );
  }

  const app = (await appResponse.json()) as AppRegistration;

  if (!app.client_id || !app.client_secret) {
    return NextResponse.redirect(
      new URL("/profile?auth=app_registration_invalid", request.url),
    );
  }

  const state = randomUUID();
  const cookiePayload: NeodbOauthCookie = {
    clientId: app.client_id,
    clientSecret: app.client_secret,
    createdAt: Date.now(),
    instance,
    redirectUri,
    state,
  };

  const authorizeUrl = new URL("/oauth/authorize", instance);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("client_id", app.client_id);
  authorizeUrl.searchParams.set("redirect_uri", redirectUri);
  authorizeUrl.searchParams.set("scope", "read write");
  authorizeUrl.searchParams.set("state", state);

  const response = NextResponse.redirect(authorizeUrl);
  response.cookies.set(OAUTH_COOKIE, sealCookie(cookiePayload), {
    ...authCookieOptions,
    maxAge: 60 * 10,
  });

  return response;
}

function getNeodbAuthBaseUrl() {
  return getConfiguredNeodbAuthInstance();
}

function getConfiguredPublicOrigin() {
  const configured =
    process.env.NEODB_REDIRECT_ORIGIN?.trim() ||
    process.env.SITE_PUBLIC_ORIGIN?.trim();

  if (configured) {
    return normalizeOrigin(configured);
  }

  return null;
}

function getRequestOrigin(request: NextRequest) {
  const forwardedHost = request.headers.get("x-forwarded-host");
  const host = forwardedHost || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto");
  const proto =
    forwardedProto ||
    (request.nextUrl.protocol ? request.nextUrl.protocol.replace(":", "") : "http");

  if (host && !isWildcardHost(host)) {
    return `${proto}://${host}`;
  }

  return request.nextUrl.origin;
}

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//.test(value)
    ? value
    : `${getDefaultProtocol(value)}://${value}`;
  return new URL(withProtocol).origin;
}

function shouldUseConfiguredOrigin(configuredOrigin: string, requestOrigin: string) {
  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return configuredOrigin !== requestOrigin;
}

function getDefaultProtocol(value: string) {
  const host = value.split("/")[0].split(":")[0];

  return host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0"
    ? "http"
    : "https";
}

function isSameApexDomain(left: string, right: string) {
  const leftUrl = new URL(left);
  const rightUrl = new URL(right);

  if (leftUrl.protocol !== rightUrl.protocol) {
    return false;
  }

  return stripWww(leftUrl.hostname) === stripWww(rightUrl.hostname);
}

function stripWww(hostname: string) {
  return hostname.startsWith("www.") ? hostname.slice(4) : hostname;
}

function isWildcardHost(host: string) {
  const hostname = host.split(":")[0];
  return hostname === "0.0.0.0" || hostname === "::" || hostname === "[::]";
}

function logAuthError(label: string, error: unknown) {
  if (process.env.NEODB_DEBUG !== "1") {
    return;
  }

  console.error(`[neodb-auth] ${label}`, error);
}
