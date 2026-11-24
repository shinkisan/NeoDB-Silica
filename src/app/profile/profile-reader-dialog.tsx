"use client";

import { createPortal } from "react-dom";
import { ReviewReader } from "@/components/review-reader";

export function ProfileReaderDialog({
  body,

  isLoading,
  onClose,
  title,
}: {
  body: string;

  isLoading: boolean;
  onClose: () => void;
  title: string;
}) {
  return createPortal(
    <ReviewReader
      body={body}

      isLoading={isLoading}
      onClose={onClose}
      showShare={false}
      title={title}
    />,
    document.body,
  );
}
