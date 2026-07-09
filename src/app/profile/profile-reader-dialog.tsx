"use client";

import { createPortal } from "react-dom";
import { ReviewReader } from "@/components/review-reader";

export function ProfileReaderDialog({
  body,
  isClosing,
  isLoading,
  onClose,
  title,
}: {
  body: string;
  isClosing: boolean;
  isLoading: boolean;
  onClose: () => void;
  title: string;
}) {
  return createPortal(
    <ReviewReader
      body={body}
      isClosing={isClosing}
      isLoading={isLoading}
      onClose={onClose}
      showShare={false}
      title={title}
    />,
    document.body,
  );
}
