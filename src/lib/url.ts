/**
 * The current git branch, baked into the bundle at Netlify build time via the
 * NEXT_PUBLIC_BRANCH=${BRANCH:-main} build command in netlify.toml.
 * Falls back to 'main' for local development or any build that doesn't set the var.
 */
export const CURRENT_BRANCH = process.env.NEXT_PUBLIC_BRANCH || 'main';

/**
 * Get the base URL for the application.
 * In preview/deploy contexts, uses the current host.
 * In production, uses the configured production URL.
 *
 * This allows links to work correctly in Netlify preview deployments
 * while maintaining proper URLs in production.
 */
export function getBaseUrl(): string {
  // Server-side: use environment variable or sensible defaults
  if (typeof window === "undefined") {
    // Prefer explicitly configured base URL
    if (process.env.NEXT_PUBLIC_BASE_URL) {
      return process.env.NEXT_PUBLIC_BASE_URL;
    }

    // In local development, match the default Next.js dev URL so
    // server-rendered markup matches the client during hydration.
    if (process.env.NODE_ENV === "development") {
      return "http://localhost:3000";
    }

    // Fallback to production site URL
    return "https://docs.hivecommons.dev";
  }

  // Client-side: detect if we're on a preview deployment
  const host = window.location.host;
  const protocol = window.location.protocol;

  // Check if we're on a Netlify preview or other non-production domain.
  // Use exact-match or proper suffix checks rather than substring includes() to
  // prevent hostname bypass (CWE-20 / CodeQL js/incomplete-url-substring-sanitization).
  const hostname = host.split(":")[0]; // strip port for comparison
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname.endsWith(".netlify.app")
  ) {
    // Use the current host for preview/local environments
    return `${protocol}//${host}`;
  }

  // Default to production URL
  return process.env.NEXT_PUBLIC_BASE_URL || "https://docs.hivecommons.dev";
}

/**
 * Convert an absolute URL to use the current base URL if it's a docs.hivecommons.dev URL.
 * External URLs are left unchanged.
 *
 * @param url - The URL to convert (can be relative or absolute)
 * @returns The URL adjusted for the current environment
 */
export function getLocalizedUrl(url: string): string {
  // If it's already a relative URL, return as-is
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return url;
  }

  // Parse the URL to check the hostname
  try {
    const urlObj = new URL(url);

    // If it's a docs.hivecommons.dev URL, replace with current base
    if (urlObj.hostname === "docs.hivecommons.dev") {
      const baseUrl = getBaseUrl();
      return `${baseUrl}${urlObj.pathname}${urlObj.search}${urlObj.hash}`;
    }
  } catch (error) {
    // If URL parsing fails, return the original URL
    console.error("Failed to parse URL:", url, error);
    return url;
  }

  // Return external URLs unchanged
  return url;
}
