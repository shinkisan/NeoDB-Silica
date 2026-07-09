/**
 * Decides how a user account should be linked from social surfaces.
 *
 * NeoDB returns a fully-qualified `acct` (`username@domain`) even for local
 * accounts, so remoteness must be derived by comparing the account's canonical
 * URL host against the instance host — done server-side where the instance is
 * known. Local accounts resolve inside the app at `/user/<id>`; remote accounts
 * have no usable in-app profile, so they open externally at their canonical URL.
 */
export function isRemoteAccount(
  accountUrl: string | null | undefined,
  instanceHost: string | null | undefined,
): boolean {
  if (!accountUrl || !instanceHost) {
    return false;
  }

  try {
    return new URL(accountUrl).hostname !== instanceHost;
  } catch {
    return false;
  }
}

export type AccountLinkTarget =
  | { external: true; href: string }
  | { external: false; href: string };

export function resolveAccountLink({
  accountId,
  isRemote,
  url,
}: {
  accountId: string | null | undefined;
  isRemote: boolean;
  url: string | null | undefined;
}): AccountLinkTarget | null {
  if (isRemote) {
    return url ? { external: true, href: url } : null;
  }

  return accountId
    ? { external: false, href: `/user/${encodeURIComponent(accountId)}` }
    : null;
}
