"use client";

import { useContext } from "react";
import { I18nContext } from "./i18n-provider";

export function useT() {
  return useContext(I18nContext).t;
}
