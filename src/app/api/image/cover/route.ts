import { NextResponse } from "next/server";
import sharp from "sharp";
import { isSupportedCoverImageUrl } from "@/lib/cover-image";
import { configureServerFetchProxy } from "@/lib/server-fetch";

export const runtime = "nodejs";

const CACHE_CONTROL = "public, max-age=31536000, immutable";
const VERCEL_CDN_CACHE_CONTROL = "public, max-age=31536000";
const FETCH_TIMEOUT_MS = 8_000;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const OUTPUT_WIDTH = 480;
const OUTPUT_QUALITY = 74;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("url");

  if (!source || !isSupportedCoverImageUrl(source)) {
    return NextResponse.json(
      { error: "Unsupported cover image URL." },
      { status: 400 },
    );
  }

  configureServerFetchProxy();

  try {
    const sourceResponse = await fetchSourceImage(source);

    if (!sourceResponse.ok) {
      return redirectToSource(source);
    }

    const contentType = sourceResponse.headers.get("content-type") || "";

    if (!contentType.startsWith("image/")) {
      return redirectToSource(source);
    }

    const contentLength = Number(sourceResponse.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_SOURCE_BYTES) {
      return redirectToSource(source);
    }

    const input = Buffer.from(await sourceResponse.arrayBuffer());

    if (input.byteLength > MAX_SOURCE_BYTES) {
      return redirectToSource(source);
    }

    const output = await sharp(input, { animated: false, limitInputPixels: 24_000_000 })
      .rotate()
      .resize({
        fit: "inside",
        width: OUTPUT_WIDTH,
        withoutEnlargement: true,
      })
      .webp({ quality: OUTPUT_QUALITY })
      .toBuffer();
    const body = new Uint8Array(output).buffer;

    return new NextResponse(body, {
      headers: {
        "Cache-Control": CACHE_CONTROL,
        "Content-Type": "image/webp",
        "Vercel-CDN-Cache-Control": VERCEL_CDN_CACHE_CONTROL,
      },
    });
  } catch (error) {
    console.error("[image] cover proxy failed", error);
    return redirectToSource(source);
  }
}

async function fetchSourceImage(source: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(source, {
      headers: { Accept: "image/avif,image/webp,image/*,*/*;q=0.8" },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function redirectToSource(source: string) {
  const response = NextResponse.redirect(source, 307);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
