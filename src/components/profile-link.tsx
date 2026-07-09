"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { pushNavigationFrame } from "@/components/navigation-history";
import { resolveAccountLink } from "@/lib/account-link";

/**
 * Links to a user's profile, choosing the right target automatically:
 * local accounts open the in-app `/user/<id>` profile (and join the semantic
 * navigation stack), while federated accounts open their canonical profile in
 * a new tab. Falls back to a plain wrapper when the account can't be linked.
 */
export function ProfileLink({
  accountId,
  ariaLabel,
  className,
  children,
  isRemote,
  onNavigate,
  url,
}: {
  accountId: string | null | undefined;
  ariaLabel?: string;
  className?: string;
  children: ReactNode;
  isRemote: boolean;
  onNavigate?: (href: string) => void;
  url: string | null | undefined;
}) {
  const target = resolveAccountLink({ accountId, isRemote, url });

  if (!target) {
    return (
      <span aria-label={ariaLabel} className={className}>
        {children}
      </span>
    );
  }

  if (target.external) {
    return (
      <a
        aria-label={ariaLabel}
        className={className}
        href={target.href}
        rel="noreferrer"
        target="_blank"
      >
        {children}
      </a>
    );
  }

  return (
    <Link
      aria-label={ariaLabel}
      className={className}
      href={target.href}
      onClick={() => {
        onNavigate?.(target.href);
        pushNavigationFrame("detail", target.href);
      }}
    >
      {children}
    </Link>
  );
}
