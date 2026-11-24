"use client";

import { useParams } from "next/navigation";
import { CoverTransition, usePendingCoverSrc } from "@/components/cover-transition";

export function PendingDetailCover() {
  const { uuid } = useParams<{ uuid?: string }>();
  const src = usePendingCoverSrc(uuid);
  const className = "h-full overflow-hidden rounded-2xl shadow-[0_8px_30px_rgb(74,85,104,0.12)]";

  if (!uuid || process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "1") {
    return <div className={`skeleton ${className}`} />;
  }

  return (
    <CoverTransition
      className={`${src ? "bg-[var(--skeleton-color)]" : "skeleton"} ${className}`}
      id={uuid}
    >
      {src && <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(src)})` }} />}
    </CoverTransition>
  );
}
