"use client";

import Link from "next/link";
import { type ReactNode } from "react";
import { preserveCreditsScroll } from "./credits-scroll";

export function CreditsPersonLink({
  category,
  children,
  className,
  href,
  itemUuid,
}: {
  category: string;
  children: ReactNode;
  className?: string;
  href: string;
  itemUuid: string;
}) {
  function openPersonWorks() {
    preserveCreditsScroll(category, itemUuid);
  }

  return (
    <Link
      className={className}
      href={href}
      onClick={openPersonWorks}
      onPointerDown={openPersonWorks}
    >
      {children}
    </Link>
  );
}
