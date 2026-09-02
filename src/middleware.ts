import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { locales, defaultLocale } from "./i18n/settings";

const intlMiddleware = createMiddleware({
  locales,
  defaultLocale,
  localePrefix: "always",
});

export default function middleware(request: NextRequest) {
  // Redirect localized docs URLs to non-localized version
  // e.g., /es/docs/... -> /docs/...
  const docsPathMatch = request.nextUrl.pathname.match(/^\/([a-z]{2}(?:-[A-Z]{2})?|SC)\/docs\//);
  if (docsPathMatch) {
    const url = request.nextUrl.clone();
    // Remove the locale prefix from the pathname
    url.pathname = url.pathname.replace(/^\/[a-z]{2}(?:-[A-Z]{2})?\/docs\//, '/docs/').replace(/^\/SC\/docs\//, '/docs/');
    return NextResponse.redirect(url, 307);
  }

  // The docs are the site: send the root straight to the documentation.
  if (request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/docs";
    return NextResponse.redirect(url, 307); // Use 307 to avoid aggressive caching
  }

  // Run the i18n middleware for everything else
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/((?!docs|api|_next|_vercel|code|.*\\..*).*)",
    "/",
  ],
};
