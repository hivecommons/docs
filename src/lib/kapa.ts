// Kapa.ai "Ask AI" widget configuration.
//
// The widget is OFF by default. It loads only when NEXT_PUBLIC_KAPA_WEBSITE_ID
// is set at build time (Netlify site environment variable). The value is the
// public Website Widget integration ID shown in the Kapa app under
// Integrations > Actions > Copy integration ID. It is an identifier, not a
// secret: Kapa restricts use of it to the domains enabled on the integration.
//
// The Content-Security-Policy in next.config.ts is widened with the sources
// below only when the flag is set, so a build without it keeps the original
// policy byte for byte.
//
// Source of the CSP list: https://docs.kapa.ai/integrations/faq
// (how-do-i-fix-csp-errors). The widget does not support CSP nonces and needs
// 'unsafe-inline' in style-src, which the site policy already carries.
// Optional hosts (hCaptcha, metrics.kapa.ai for fingerprinting) are left out:
// the default reCAPTCHA bot protection is used and fingerprinting is not.

export const KAPA_WIDGET_SCRIPT_SRC =
  "https://widget.kapa.ai/kapa-widget.bundle.js";

export const KAPA_PROJECT_NAME = "Hive Commons";

export function getKapaWebsiteId(
  env: Record<string, string | undefined> = process.env
): string | undefined {
  const id = env.NEXT_PUBLIC_KAPA_WEBSITE_ID?.trim();
  return id ? id : undefined;
}

export const KAPA_CSP_SOURCES = {
  "script-src": [
    "https://widget.kapa.ai",
    "https://www.google.com/recaptcha/",
    "https://www.gstatic.com",
    "https://recaptcha.google.com",
  ],
  "connect-src": [
    "https://proxy.kapa.ai",
    "https://kapa-widget-proxy-la7dkmplpq-uc.a.run.app",
    "https://storage.googleapis.com/kapa-file-uploads/",
  ],
  "frame-src": [
    "https://www.google.com/recaptcha/",
    "https://recaptcha.google.com",
  ],
} as const;
