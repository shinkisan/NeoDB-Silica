import { expect, test } from "@playwright/test";
// Relative imports on purpose (Playwright doesn't resolve the `@/` alias).
import { COOKIE_PREFIX, STORAGE_PREFIX } from "../../src/lib/runtime-ids";
import { OAUTH_COOKIE, SESSION_COOKIE } from "../../src/lib/neodb-auth";
import { FEATURED_COLLECTIONS_EMPTY_COOKIE } from "../../src/lib/featured-collections";
import { TMDB_REGION_COOKIE } from "../../src/lib/tmdb-regions";
import { THEME_COLOR_KEY, THEME_MODE_KEY } from "../../src/lib/theme";

// ⚠️ BRANCH-SPECIFIC VALUES — this file is `merge=ours`, like
// src/lib/runtime-ids.ts. If these assertions fail on a deployed instance's
// branch, the change would sign existing users out (cookie names) or discard
// their stored preferences (storage keys) — fix the code rather than updating
// the expectations.
test.describe("persistent runtime identifiers keep their exact values", () => {
  test("prefixes", () => {
    expect(STORAGE_PREFIX).toBe("app:");
    expect(COOKIE_PREFIX).toBe("app_");
  });

  test("cookie names", () => {
    expect(SESSION_COOKIE).toBe("app_neodb_session");
    expect(OAUTH_COOKIE).toBe("app_neodb_oauth");
    expect(FEATURED_COLLECTIONS_EMPTY_COOKIE).toBe(
      "app_featured_collections_empty",
    );
    expect(TMDB_REGION_COOKIE).toBe("app_tmdb_region");
  });

  test("storage keys", () => {
    expect(THEME_COLOR_KEY).toBe("app:v1:appearance:color");
    expect(THEME_MODE_KEY).toBe("app:v1:appearance:mode");
  });
});
