/// <reference types="react/canary" />

import { ViewTransition, type ReactNode } from "react";

const routeClasses = {
  "nav-forward": "nav-forward",
  "tab-left": "tab-left",
  "tab-right": "tab-right",
  default: "none",
};

export function PageMotion({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "1") return children;

  return (
    <ViewTransition default="none" update={routeClasses} share={routeClasses}>
      <div className="flex flex-1 flex-col">{children}</div>
    </ViewTransition>
  );
}

export function LoadingMotion({ children, pending }: { children: ReactNode; pending?: boolean }) {
  if (process.env.NEXT_PUBLIC_VIEW_TRANSITIONS !== "1") return children;

  return (
    <ViewTransition default="none" enter={pending ? "none" : "content-in"} exit={pending ? "skeleton-out" : "none"}>
      {children}
    </ViewTransition>
  );
}
