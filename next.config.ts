import type { NextConfig } from "next";
import path from "node:path";

type ImageRemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number];

// Allow cover images from the configured NeoDB instance (plus neodb.social as a
// sensible default) so a custom deployment's media loads through next/image.
function buildCoverImagePatterns(): ImageRemotePattern[] {
  const instances = [
    process.env.NEODB_DEFAULT_INSTANCE?.trim(),
    "https://neodb.social",
  ].filter((value): value is string => Boolean(value));

  const patterns: ImageRemotePattern[] = [];
  const seen = new Set<string>();

  for (const instance of instances) {
    try {
      const url = new URL(
        /^https?:\/\//.test(instance) ? instance : `https://${instance}`,
      );
      const key = `${url.protocol}//${url.hostname}`;

      if (seen.has(key)) {
        continue;
      }

      seen.add(key);
      patterns.push({
        hostname: url.hostname,
        pathname: "/**",
        protocol: url.protocol.replace(":", "") as "http" | "https",
      });
    } catch {
      // Ignore malformed instance values; the default neodb.social entry stands.
    }
  }

  return patterns;
}

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    dangerouslyAllowLocalIP: process.env.NODE_ENV !== "production",
    formats: ["image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 7,
    qualities: [75],
    unoptimized: true,
    remotePatterns: buildCoverImagePatterns(),
  },
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
