import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { parseCatalogDetailPath } from "@/lib/catalog-link";
import { getNeodbBaseUrl } from "@/lib/neodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

type CatalogFetchResult = {
  message: string | null;
};

type CatalogFetchRedirectedResult = CatalogFetchResult & {
  detailPath?: string;
  location?: string;
  url: string;
};

type CatalogFetchMockFixture = {
  body: CatalogFetchRedirectedResult | CatalogFetchResult;
  status: number;
};

const MOCK_HOST = "mock.bielu.local";
const MOCK_SCENARIOS = new Set([
  "accepted",
  "error",
  "found",
  "not-found",
  "rate-limited",
  "unsupported",
]);
const pendingMockStartedAt = new Map<string, number>();

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "neodb:catalog-fetch",
    limit: 30,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { message: "请求过于频繁，请稍后再试。" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get("url")?.trim();
  const mockScenario = searchParams.get("mock")?.trim();

  if (!targetUrl) {
    return NextResponse.json({ message: "链接不能为空。" }, { status: 400 });
  }

  let parsedTargetUrl: URL;

  try {
    parsedTargetUrl = new URL(targetUrl);
  } catch {
    return NextResponse.json({ message: "链接格式不正确。" }, { status: 400 });
  }

  const urlMockScenario = getMockScenarioFromUrl(parsedTargetUrl);
  const effectiveMockScenario = mockScenario || urlMockScenario || undefined;

  if (shouldUseMock(effectiveMockScenario)) {
    return readMockResponse(effectiveMockScenario || "found", targetUrl);
  }

  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  const upstream = new URL(`${baseUrl}/api/catalog/fetch`);
  upstream.searchParams.set("url", targetUrl);

  try {
    const response = await fetchWithTimeout(
      upstream,
      {
        cache: "no-store",
        headers: { Accept: "application/json" },
        redirect: "manual",
      },
      12_000,
    );
    const payload = await readCatalogFetchPayload(response, baseUrl);

    if ([202, 302, 422, 429].includes(response.status)) {
      const headers = new Headers();
      const retryAfter = response.headers.get("Retry-After");

      if (retryAfter) {
        headers.set("Retry-After", retryAfter);
      }

      return NextResponse.json(payload, {
        headers,
        status: response.status,
      });
    }

    return NextResponse.json(
      { message: payload.message || "NeoDB 导入请求失败。" },
      { status: 502 },
    );
  } catch (error) {
    console.error("[neodb] catalog fetch failed", error);

    return NextResponse.json(
      { message: "无法请求 NeoDB 导入接口。" },
      { status: 502 },
    );
  }
}

function shouldUseMock(mockScenario?: string) {
  if (!mockScenario && process.env.BIELU_MOCK_CATALOG_FETCH !== "1") {
    return false;
  }

  return process.env.NODE_ENV !== "production";
}

async function readMockResponse(mockScenario: string, targetUrl?: string) {
  const pendingDelaySeconds = getPendingThenFoundDelay(mockScenario);

  if (pendingDelaySeconds !== null) {
    const key = targetUrl || mockScenario;
    const now = Date.now();
    const startedAt = pendingMockStartedAt.get(key) || now;
    pendingMockStartedAt.set(key, startedAt);

    if (now - startedAt < pendingDelaySeconds * 1000) {
      return readMockResponse("accepted", targetUrl);
    }

    pendingMockStartedAt.delete(key);
    return readMockResponse("found", targetUrl);
  }

  const scenario = MOCK_SCENARIOS.has(mockScenario) ? mockScenario : "found";

  const filePath = path.join(
    process.cwd(),
    "ref",
    "mock",
    "catalog-fetch",
    `${scenario}.json`,
  );
  const fixture = JSON.parse(
    await readFile(filePath, "utf8"),
  ) as CatalogFetchMockFixture;

  return NextResponse.json(fixture.body, { status: fixture.status });
}

function getPendingThenFoundDelay(mockScenario: string) {
  if (mockScenario === "pending-then-found") {
    return 12;
  }

  const match = mockScenario.match(/^pending-(\d{1,3})-then-found$/);

  if (!match) {
    return null;
  }

  return Math.max(1, Math.min(120, Number(match[1])));
}

function getMockScenarioFromUrl(url: URL) {
  if (process.env.NODE_ENV === "production") {
    return null;
  }

  if (url.hostname !== MOCK_HOST) {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);

  if (segments[0] !== "catalog") {
    return null;
  }

  return segments[1] || "found";
}

async function readCatalogFetchPayload(response: Response, baseUrl: string) {
  const payload = (await response.json().catch(() => null)) as
    | (CatalogFetchRedirectedResult | CatalogFetchResult)
    | null;

  if (response.status === 302) {
    const location = response.headers.get("location");
    const detailPath = location ? parseCatalogDetailPath(location) : null;

    if (detailPath) {
      return {
        detailPath,
        location: location || undefined,
        message: payload?.message ?? null,
        url: resolveNeodbLocation(location || detailPath, baseUrl),
      };
    }
  }

  if (payload && typeof payload.message !== "undefined") {
    return payload;
  }

  return { message: null };
}

function resolveNeodbLocation(location: string, baseUrl: string) {
  if (/^https?:\/\//.test(location)) {
    return location;
  }

  return `${baseUrl}${location.startsWith("/") ? location : `/${location}`}`;
}
