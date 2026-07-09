import { NextResponse } from "next/server";
import {
  getNeodbBaseUrl,
  isSearchCategory,
  normalizeNeodbItem,
  type NeodbItem,
} from "@/lib/neodb";
import { checkRateLimit } from "@/lib/rate-limit";
import { configureServerFetchProxy, fetchWithTimeout } from "@/lib/server-fetch";

export async function GET(request: Request) {
  const rateLimit = checkRateLimit({
    keyPrefix: "neodb:search",
    limit: 45,
    request,
    windowMs: 60 * 1000,
  });

  if (rateLimit.limited) {
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试。" },
      {
        headers: { "Retry-After": String(rateLimit.retryAfter) },
        status: 429,
      },
    );
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query")?.trim();
  const category = searchParams.get("category")?.trim();
  const page = searchParams.get("page") || "1";
  const pageSize =
    searchParams.get("pageSize")?.trim() ||
    searchParams.get("pagesize")?.trim() ||
    searchParams.get("page_size")?.trim();

  if (!query) {
    return NextResponse.json(
      { error: "搜索关键词不能为空。" },
      { status: 400 },
    );
  }

  if (category && category !== "all" && !isSearchCategory(category)) {
    return NextResponse.json(
      { error: "不支持的搜索分类。" },
      { status: 400 },
    );
  }

  configureServerFetchProxy();

  const baseUrl = getNeodbBaseUrl();
  const upstream = new URL(`${baseUrl}/api/catalog/search`);
  upstream.searchParams.set("query", query);
  upstream.searchParams.set("page", page);

  if (pageSize) {
    upstream.searchParams.set("page_size", pageSize);
  }

  if (category && category !== "all") {
    upstream.searchParams.set("category", category);
  }

  try {
    const response = await fetchWithTimeout(
      upstream,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 60 * 5 },
      },
      8_000,
    );

    if (!response.ok) {
      throw new Error(`NeoDB search failed: ${response.status}`);
    }

    const payload = (await response.json()) as {
      data: NeodbItem[];
      pages: number;
      count: number;
    };

    return NextResponse.json({
      source: baseUrl,
      query,
      category: category || "all",
      page: Number(page),
      pages: payload.pages,
      count: payload.count,
      items: payload.data.map((item) => normalizeNeodbItem(item, baseUrl)),
    });
  } catch (error) {
    console.error("[neodb] search failed", error);
    return NextResponse.json(
      { error: "无法执行 NeoDB 搜索。" },
      { status: 502 },
    );
  }
}
