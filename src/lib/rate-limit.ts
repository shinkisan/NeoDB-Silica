type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, RateLimitEntry>();

type RateLimitOptions = {
  keyPrefix: string;
  limit: number;
  request: Request;
  windowMs: number;
};

export function checkRateLimit({
  keyPrefix,
  limit,
  request,
  windowMs,
}: RateLimitOptions) {
  const now = Date.now();
  const key = `${keyPrefix}:${getClientIp(request)}`;
  const entry = buckets.get(key);

  if (!entry || entry.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + windowMs,
    });

    return {
      limited: false,
      retryAfter: 0,
    };
  }

  entry.count += 1;

  if (entry.count <= limit) {
    return {
      limited: false,
      retryAfter: 0,
    };
  }

  return {
    limited: true,
    retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
  };
}

// A single shared bucket key, used when the deployment can't trust
// client-supplied IP headers (see getClientIp below). Rate limits everyone
// together instead of trusting a spoofable per-visitor identity — blunter,
// but not bypassable by rotating a fake header value.
const UNTRUSTED_PROXY_BUCKET_KEY = "shared";

function getClientIp(request: Request) {
  // x-forwarded-for/x-real-ip are only trustworthy when a real reverse proxy
  // sits in front of this app and overwrites whatever the client sent —
  // true on Vercel (the default assumption here) but not guaranteed for a
  // self-hosted deployment exposed directly to the internet, or behind a
  // reverse proxy that doesn't strip inbound client headers. Set
  // TRUST_PROXY_HEADERS=0 in that case so a spoofed header can't be used to
  // get a fresh rate-limit bucket on every request.
  if (process.env.TRUST_PROXY_HEADERS === "0") {
    return UNTRUSTED_PROXY_BUCKET_KEY;
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}
