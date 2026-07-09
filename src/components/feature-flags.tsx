"use client";

import { createContext, useContext } from "react";
import type { FeatureFlags } from "@/lib/feature-flags";

const DEFAULT_FLAGS: FeatureFlags = {
  tmdb: false,
  translate: false,
};

const FeatureFlagsContext = createContext<FeatureFlags>(DEFAULT_FLAGS);

export function FeatureFlagsProvider({
  children,
  value,
}: {
  children: React.ReactNode;
  value: FeatureFlags;
}) {
  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

export function useFeatureFlags(): FeatureFlags {
  return useContext(FeatureFlagsContext);
}
