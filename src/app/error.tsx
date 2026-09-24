"use client";

import ErrorFallbackUI from "@/components/ErrorFallbackUI";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorFallbackUI reset={reset} />;
}
