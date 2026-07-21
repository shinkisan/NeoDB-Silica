"use client";

import { lazy } from "react";

export const LazyReadingProgressDialog = lazy(() =>
  import("@/components/reading-progress-dialog").then((module) => ({
    default: module.ReadingProgressDialog,
  })),
);
