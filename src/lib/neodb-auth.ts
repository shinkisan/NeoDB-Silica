import crypto from "node:crypto";

export const OAUTH_COOKIE = "bielu_neodb_oauth";
export const SESSION_COOKIE = "bielu_neodb_session";

export type NeodbOauthCookie = {
  clientId: string;
  clientSecret: string;
  createdAt: number;
  instance: string;
  redirectUri: string;
  state: string;
};

export type NeodbSessionCookie = {
  accessToken: string;
  createdAt: number;
  instance: string;
  scope: string;
  tokenType: string;
};

const maxCookieAge = 60 * 60 * 24 * 30;

export const authCookieOptions = {
  httpOnly: true,
  maxAge: maxCookieAge,
  path: "/",
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
};

export function sealCookie<T>(payload: T) {
  const secret = getSessionSecret();
  const key = crypto.createHash("sha256").update(secret).digest();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv, tag, encrypted].map(base64url).join(".");
}

export function openCookie<T>(value: string | undefined): T | null {
  if (!value) {
    return null;
  }

  try {
    const [ivValue, tagValue, encryptedValue] = value.split(".");
    if (!ivValue || !tagValue || !encryptedValue) {
      return null;
    }

    const secret = getSessionSecret();
    const key = crypto.createHash("sha256").update(secret).digest();
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      key,
      fromBase64url(ivValue),
    );

    decipher.setAuthTag(fromBase64url(tagValue));

    const decrypted = Buffer.concat([
      decipher.update(fromBase64url(encryptedValue)),
      decipher.final(),
    ]);

    return JSON.parse(decrypted.toString("utf8")) as T;
  } catch {
    return null;
  }
}

function getSessionSecret() {
  const secret = process.env.NEODB_SESSION_SECRET?.trim();

  if (!secret) {
    throw new Error("NEODB_SESSION_SECRET is required for NeoDB login.");
  }

  return secret;
}

function base64url(value: Buffer) {
  return value.toString("base64url");
}

function fromBase64url(value: string) {
  return Buffer.from(value, "base64url");
}
