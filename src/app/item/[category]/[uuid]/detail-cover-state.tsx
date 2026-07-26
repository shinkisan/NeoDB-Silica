"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type DetailCoverState = {
  currentSrc: string;
  switchToFallback: () => boolean;
};

const DetailCoverContext = createContext<DetailCoverState | null>(null);

export function DetailCoverProvider({
  children,
  fallbackSrc,
  initialSrc,
}: {
  children: ReactNode;
  fallbackSrc?: string | null;
  initialSrc?: string | null;
}) {
  const [currentSrc, setCurrentSrc] = useState(initialSrc || "");

  const switchToFallback = useCallback(() => {
    if (!fallbackSrc || currentSrc === fallbackSrc) {
      return false;
    }

    setCurrentSrc(fallbackSrc);
    return true;
  }, [currentSrc, fallbackSrc]);

  const value = useMemo(
    () => ({ currentSrc, switchToFallback }),
    [currentSrc, switchToFallback],
  );

  return (
    <DetailCoverContext.Provider value={value}>
      {children}
    </DetailCoverContext.Provider>
  );
}

export function useDetailCover(initialSrc?: string | null) {
  const sharedState = useContext(DetailCoverContext);

  return {
    currentSrc: sharedState?.currentSrc || initialSrc || "",
    switchToFallback: sharedState?.switchToFallback || (() => false),
  };
}
