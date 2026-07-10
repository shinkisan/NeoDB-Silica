import { defineConfig, devices } from "@playwright/test";
import { APP_ORIGIN, APP_PORT, MOCK_ORIGIN, TEST_SESSION_SECRET } from "./e2e/helpers/env";

export default defineConfig({
  expect: { timeout: 15_000 },
  fullyParallel: false,
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  reporter: [["list"]],
  retries: 0,
  testDir: "./e2e/specs",
  timeout: 60_000,
  use: {
    baseURL: APP_ORIGIN,
    locale: "zh-CN",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "node e2e/mock-neodb/server.mjs",
      reuseExistingServer: true,
      url: `${MOCK_ORIGIN}/api/trending/book/`,
    },
    {
      command: `npx next dev --port ${APP_PORT}`,
      env: {
        // Explicit values take precedence over .env.local, so a developer's
        // real instance/proxy/API keys can't leak into the test run.
        AZURE_TRANSLATOR_ENDPOINT: "",
        AZURE_TRANSLATOR_KEY: "",
        AZURE_TRANSLATOR_REGION: "",
        GOOGLE_BOOKS_API_KEY: "",
        HTTP_PROXY: "",
        HTTPS_PROXY: "",
        NEODB_AUTH_INSTANCE: MOCK_ORIGIN,
        NEODB_DEFAULT_INSTANCE: MOCK_ORIGIN,
        NEODB_PROXY_URL: "",
        NEODB_SESSION_SECRET: TEST_SESSION_SECRET,
        TMDB_ACCESS_TOKEN: "",
        TMDB_API_KEY: "",
      },
      reuseExistingServer: true,
      timeout: 120_000,
      url: APP_ORIGIN,
    },
  ],
  // The mock holds mutable state shared across tests; keep runs serial.
  workers: 1,
});
