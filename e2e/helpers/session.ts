import type { BrowserContext } from "@playwright/test";
// Relative import on purpose: Playwright doesn't resolve the app's `@/`
// tsconfig alias. Importing the real constants keeps the suite locked to the
// app's actual cookie name and sealing format.
import { sealCookie, SESSION_COOKIE, type NeodbSessionCookie } from "../../src/lib/neodb-auth";
import { APP_ORIGIN, MOCK_ORIGIN, TEST_SESSION_SECRET } from "./env";

/**
 * Mints a valid session cookie (same AES-256-GCM sealing the app uses) and
 * injects it into the browser context, bypassing the OAuth dance entirely.
 * The payload's `instance` points at the mock server — authenticated proxy
 * routes read the upstream base URL from the session, not from env.
 */
export async function signIn(context: BrowserContext) {
  process.env.NEODB_SESSION_SECRET = TEST_SESSION_SECRET;

  const payload: NeodbSessionCookie = {
    accessToken: "e2e-test-token",
    createdAt: Date.now(),
    instance: MOCK_ORIGIN,
    scope: "read write",
    tokenType: "Bearer",
  };

  await context.addCookies([
    {
      httpOnly: true,
      name: SESSION_COOKIE,
      sameSite: "Lax",
      url: APP_ORIGIN,
      value: sealCookie(payload),
    },
  ]);
}
