import crypto from "node:crypto";
import type { NeodbSessionCookie } from "@/lib/neodb-auth";

export function getSessionCacheScope(session: NeodbSessionCookie) {
  return crypto
    .createHash("sha256")
    .update(`${session.instance}:${session.createdAt}`)
    .digest("base64url")
    .slice(0, 20);
}
