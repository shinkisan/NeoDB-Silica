import { promises as dns } from "node:dns";

/**
 * Resolves `rawUrl`'s hostname and rejects it if it points at loopback,
 * private, link-local (including the 169.254.169.254 cloud metadata
 * endpoint), or otherwise non-public address space. Use this before a server
 * fetches any URL supplied by a client/user, when the target host is
 * legitimately variable (so a fixed hostname allowlist isn't an option) —
 * see `src/app/api/neodb/avatar/route.ts` for the motivating case: a NeoDB
 * account's avatar can point at any federated host.
 *
 * This is a single DNS resolution at request time, not a per-connection
 * check, so it does not fully defend against DNS-rebinding (an attacker
 * whose domain resolves to a public IP at check time and a private IP at
 * connect time). That residual risk is accepted here in exchange for not
 * needing a custom fetch agent; combine with a response size cap and a
 * content-type allowlist for defense in depth.
 */
export async function isPubliclyRoutableUrl(rawUrl: string): Promise<boolean> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch {
    return false;
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return false;
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (hostname === "localhost") {
    return false;
  }

  try {
    const { address, family } = await dns.lookup(hostname);
    return family === 6 ? isPublicIPv6(address) : isPublicIPv4(address);
  } catch {
    return false;
  }
}

function isPublicIPv4(address: string): boolean {
  const parts = address.split(".").map(Number);

  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return false;
  }

  const [a, b] = parts;

  if (a === 0) return false; // "this network"
  if (a === 10) return false; // RFC1918 private
  if (a === 127) return false; // loopback
  if (a === 169 && b === 254) return false; // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return false; // RFC1918 private
  if (a === 192 && b === 168) return false; // RFC1918 private
  if (a >= 224) return false; // multicast + reserved

  return true;
}

function isPublicIPv6(address: string): boolean {
  const normalized = address.toLowerCase();

  if (normalized === "::1") return false; // loopback
  if (normalized === "::") return false; // unspecified
  if (normalized.startsWith("fe80:")) return false; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false; // unique local, fc00::/7

  const ipv4MappedMatch = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);

  if (ipv4MappedMatch) {
    return isPublicIPv4(ipv4MappedMatch[1]);
  }

  return true;
}
