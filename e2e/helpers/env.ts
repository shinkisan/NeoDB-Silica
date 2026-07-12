// Shared constants between playwright.config.ts, the mock server, and specs.

export const APP_PORT = 3100;
export const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;

export const MOCK_PORT = 3199;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;

// Fixed secret for the test run; the app's webServer gets the same value so
// cookies minted by the suite open cleanly inside the app.
export const TEST_SESSION_SECRET = "e2e-test-session-secret";

// Fixture handles used by specs. Values must match e2e/mock-neodb/fixtures.mjs
// (kept as plain .mjs so the dependency-free mock server can import it).
export const BOOK_UUID = "e2ebook00000000000000001";
export const BOOK_TITLE = "测试之书";
export const MOVIE_UUID = "e2emovie0000000000000001";
export const MOVIE_TITLE = "测试电影";
export const OWN_COMMENT_TEXT = "这是自己的测试短评";
export const OTHER_COMMENT_TEXT = "这是别人的测试短评";
export const MY_DISPLAY_NAME = "测试用户";
export const REMOTE_SPOILER_CONTENT = "揭晓结局，主角最后其实是卧底";
export const REMOTE_SPOILER_WARNING = "可能包含剧透";
export const REVIEW_TEASER_TEXT = "a review of 测试电影";
export const REMOTE_ITEM_URL = "https://eggplant.place/movie/6SnxLxSAl1VwqLV0HlebTs";
export const REMOTE_ITEM_NAME = "远端电影条目";
export const OTHER_DISPLAY_NAME = "另一位用户";
export const MY_BRIDGE_DISPLAY_NAME = "测试用户（跨站桥接）";
