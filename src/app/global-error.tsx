"use client";

import ErrorFallbackUI from "@/components/ErrorFallbackUI";

// Root-level error boundary. Keep this dependency-light: the shared fallback
// uses inline Hive Commons theme styles so it still renders during asset-load
// or runtime failures.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <ErrorFallbackUI reset={reset} />
      </body>
    </html>
  );
}
