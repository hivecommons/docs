import Script from "next/script";

import {
  KAPA_PROJECT_NAME,
  KAPA_WIDGET_SCRIPT_SRC,
  getKapaWebsiteId,
} from "@/lib/kapa";

/**
 * Kapa.ai "Ask AI" widget. Renders nothing unless NEXT_PUBLIC_KAPA_WEBSITE_ID
 * is set at build time, so the default build ships no third-party script.
 * The website ID is a public integration identifier, not a secret (Kapa gates
 * it by allowed domain). See src/lib/kapa.ts for the matching CSP allowances.
 */
export default function KapaWidget() {
  const websiteId = getKapaWebsiteId();
  if (!websiteId) return null;

  return (
    <Script
      src={KAPA_WIDGET_SCRIPT_SRC}
      strategy="afterInteractive"
      data-website-id={websiteId}
      data-project-name={KAPA_PROJECT_NAME}
    />
  );
}
