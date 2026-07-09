import { NextRequest, NextResponse } from "next/server";
import {
  authCookieOptions,
  OAUTH_COOKIE,
  openCookie,
  sealCookie,
  SESSION_COOKIE,
  type NeodbOauthCookie,
  type NeodbSessionCookie,
} from "@/lib/neodb-auth";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type TokenResponse = {
  access_token?: string;
  scope?: string;
  token_type?: string;
};

export async function GET(request: NextRequest) {
  configureServerFetchProxy();

  const error = request.nextUrl.searchParams.get("error");
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const oauthState = openCookie<NeodbOauthCookie>(
    request.cookies.get(OAUTH_COOKIE)?.value,
  );

  const profileUrl = new URL("/profile", request.url);

  if (error) {
    profileUrl.searchParams.set("auth", "denied");
    return redirectAndClearOauth(profileUrl);
  }

  if (!code || !state || !oauthState || oauthState.state !== state) {
    profileUrl.searchParams.set("auth", "invalid_state");
    return redirectAndClearOauth(profileUrl);
  }

  if (Date.now() - oauthState.createdAt > 10 * 60 * 1000) {
    profileUrl.searchParams.set("auth", "expired");
    return redirectAndClearOauth(profileUrl);
  }

  let tokenResponse: Response;

  try {
    tokenResponse = await fetchWithTimeout(`${oauthState.instance}/oauth/token`, {
      body: new URLSearchParams({
        client_id: oauthState.clientId,
        client_secret: oauthState.clientSecret,
        code,
        grant_type: "authorization_code",
        redirect_uri: oauthState.redirectUri,
      }),
      method: "POST",
    }, 8_000);
  } catch (error) {
    logAuthError("token_fetch_failed", error);
    profileUrl.searchParams.set("auth", "token_fetch_failed");
    return redirectAndClearOauth(profileUrl);
  }

  if (!tokenResponse.ok) {
    profileUrl.searchParams.set("auth", "token_failed");
    return redirectAndClearOauth(profileUrl);
  }

  const token = (await tokenResponse.json()) as TokenResponse;

  if (!token.access_token) {
    profileUrl.searchParams.set("auth", "token_invalid");
    return redirectAndClearOauth(profileUrl);
  }

  const session: NeodbSessionCookie = {
    accessToken: token.access_token,
    createdAt: Date.now(),
    instance: oauthState.instance,
    scope: token.scope || "",
    tokenType: token.token_type || "Bearer",
  };

  const response = redirectAndClearOauth(profileUrl);
  response.cookies.set(SESSION_COOKIE, sealCookie(session), authCookieOptions);

  return response;
}

function redirectAndClearOauth(url: URL) {
  const response = NextResponse.redirect(url);
  response.cookies.delete(OAUTH_COOKIE);

  return response;
}

function logAuthError(label: string, error: unknown) {
  if (process.env.NEODB_DEBUG !== "1") {
    return;
  }

  console.error(`[neodb-auth] ${label}`, error);
}
