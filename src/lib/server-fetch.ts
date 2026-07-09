import { ProxyAgent, setGlobalDispatcher } from "undici";
import { cookies } from "next/headers";

const proxyDispatcherFlag = Symbol.for("bielu.neodb.proxyDispatcher");
const DEFAULT_FETCH_TIMEOUT_MS = 10_000;

export type ServerFetchInit = RequestInit & {
  next?: {
    revalidate?: false | number;
    tags?: string[];
  };
};

export function configureServerFetchProxy() {
  const globalState = globalThis as typeof globalThis & {
    [proxyDispatcherFlag]?: boolean;
  };

  if (globalState[proxyDispatcherFlag]) {
    return;
  }

  const proxyUrl =
    process.env.NEODB_PROXY_URL ||
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy;

  if (proxyUrl) {
    setGlobalDispatcher(new ProxyAgent(proxyUrl));
  }

  globalState[proxyDispatcherFlag] = true;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: ServerFetchInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const { signal, headers, ...restInit } = init;

  function abortFromParent() {
    controller.abort();
  }

  if (signal) {
    if (signal.aborted) {
      controller.abort();
    } else {
      signal.addEventListener("abort", abortFromParent, { once: true });
    }
  }

  const mergedHeaders = new Headers(headers as HeadersInit | undefined);

  if (!mergedHeaders.has("Accept-Language")) {
    const lang = await getNeoDBAcceptLanguage();

    if (lang) {
      mergedHeaders.set("Accept-Language", lang);
    }
  }

  try {
    return await fetch(input, {
      ...restInit,
      headers: mergedHeaders,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", abortFromParent);
  }
}

export function localeToNeoDBAcceptLanguage(locale: string): string | undefined {
  const langMap: Record<string, string> = {
    "zh-Hans": "zh-hans, zh;q=0.9, en;q=0.5",
    "zh-Hant": "zh-hant, zh;q=0.9, en;q=0.5",
    en: "en;q=0.9, zh-hans;q=0.5",
  };

  return langMap[locale];
}

async function getNeoDBAcceptLanguage(): Promise<string | undefined> {
  try {
    const cookieStore = await cookies();
    const locale = cookieStore.get("NEXT_LOCALE")?.value;

    if (!locale) {
      return undefined;
    }

    return localeToNeoDBAcceptLanguage(locale);
  } catch {
    return undefined;
  }
}

export function isFetchTimeoutError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}
