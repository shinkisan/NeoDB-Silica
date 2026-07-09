import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { fetchWithTimeout } from "@/lib/server-fetch";

type TranslateRequest = {
  targetLanguage?: string;
  text?: string;
};

type AzureTranslationResponse = Array<{
  translations?: Array<{
    text?: string;
    to?: string;
  }>;
}>;

const MAX_TEXT_LENGTH = 5_000;
const MAX_TRANSLATION_SEGMENTS = 100;
const TARGET_LANGUAGES = new Set(["en", "zh-Hans", "zh-Hant"]);

export async function POST(request: Request) {
  // Each request costs money against the operator's Azure Translator quota,
  // and this endpoint has no auth requirement (translation is available to
  // anonymous readers, matching how the translate button is shown on public
  // timeline/comment content) — rate-limit per IP so it can't be used as an
  // unauthenticated cost-amplification vector.
  const rateLimit = checkRateLimit({
    keyPrefix: "translate",
    limit: 20,
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

  const body = (await request.json().catch(() => null)) as TranslateRequest | null;
  const text = body?.text?.trim();
  const targetLanguage = body?.targetLanguage?.trim();

  if (
    !text ||
    text.length > MAX_TEXT_LENGTH ||
    !targetLanguage ||
    !TARGET_LANGUAGES.has(targetLanguage)
  ) {
    return NextResponse.json({ error: "Invalid translation request." }, { status: 400 });
  }

  const key = process.env.AZURE_TRANSLATOR_KEY?.trim();
  const region = process.env.AZURE_TRANSLATOR_REGION?.trim();
  const endpoint = process.env.AZURE_TRANSLATOR_ENDPOINT?.trim();

  if (!key || !endpoint) {
    console.error("[translate] Azure Translator is not configured");
    return NextResponse.json(
      { error: "Translation service unavailable." },
      { status: 503 },
    );
  }

  try {
    const segments = parseTranslationSegments(text);
    const translatableSegments = segments.filter((segment) => segment.text);

    if (translatableSegments.length > MAX_TRANSLATION_SEGMENTS) {
      return NextResponse.json(
        { error: "Translation request has too many segments." },
        { status: 400 },
      );
    }

    const url = new URL(`${endpoint.replace(/\/+$/, "")}/translate`);
    url.searchParams.set("api-version", "3.0");
    url.searchParams.set("to", targetLanguage);

    const headers = new Headers({
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": key,
      "X-ClientTraceId": randomUUID(),
    });

    if (region) {
      headers.set("Ocp-Apim-Subscription-Region", region);
    }

    const response = await fetchWithTimeout(
      url,
      {
        body: JSON.stringify(
          translatableSegments.map((segment) => ({ Text: segment.text })),
        ),
        cache: "no-store",
        headers,
        method: "POST",
      },
      10_000,
    );

    if (!response.ok) {
      console.error("[translate] Azure Translator request failed", {
        status: response.status,
      });
      return NextResponse.json(
        { error: "Translation service unavailable." },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as AzureTranslationResponse;
    let responseIndex = 0;
    const translatedSegments = segments.map((segment) => {
      if (!segment.text) {
        return {
          ...segment,
          text: `${segment.leadingWhitespace}${segment.trailingWhitespace}`,
        };
      }

      const translatedText =
        payload[responseIndex]?.translations?.[0]?.text?.trim();
      responseIndex += 1;

      return translatedText
        ? {
            ...segment,
            text: `${segment.leadingWhitespace}${translatedText}${segment.trailingWhitespace}`,
          }
        : null;
    });

    if (translatedSegments.some((segment) => !segment)) {
      console.error("[translate] Azure Translator returned an empty response");
      return NextResponse.json(
        { error: "Translation service unavailable." },
        { status: 502 },
      );
    }

    const translatedText = translatedSegments
      .map((segment) =>
        segment?.isSpoiler ? `>!${segment.text}!<` : segment?.text,
      )
      .join("");

    return NextResponse.json(
      { translatedText },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("[translate] Azure Translator request failed", error);
    return NextResponse.json(
      { error: "Translation service unavailable." },
      { status: 502 },
    );
  }
}

function parseTranslationSegments(text: string) {
  const segments: Array<{
    isSpoiler: boolean;
    leadingWhitespace: string;
    text: string;
    trailingWhitespace: string;
  }> = [];
  const spoilerPattern = />!([^!]+)!</g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = spoilerPattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(
        createTranslationSegment(text.slice(lastIndex, match.index), false),
      );
    }

    segments.push(createTranslationSegment(match[1], true));
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    segments.push(createTranslationSegment(text.slice(lastIndex), false));
  }

  return segments.length > 0
    ? segments
    : [createTranslationSegment(text, false)];
}

function createTranslationSegment(text: string, isSpoiler: boolean) {
  const core = text.trim();

  if (!core) {
    return {
      isSpoiler,
      leadingWhitespace: "",
      text: "",
      trailingWhitespace: text,
    };
  }

  const coreStart = text.indexOf(core);
  const coreEnd = coreStart + core.length;

  return {
    isSpoiler,
    leadingWhitespace: text.slice(0, coreStart),
    text: core,
    trailingWhitespace: text.slice(coreEnd),
  };
}
