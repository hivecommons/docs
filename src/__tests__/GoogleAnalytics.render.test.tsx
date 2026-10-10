// @vitest-environment jsdom
//
// Render coverage for the GoogleAnalytics component itself (gtagEvent.test.ts
// only covers the exported helper). The component is the single place the
// GA4 measurement ID and load strategy live, so a typo there silently drops
// every page_view; pin both:
//  - the gtag.js loader points at the measurement ID with afterInteractive
//  - the inline init snippet configures the same ID with page_path and
//    send_page_view, also afterInteractive, so neither tag blocks hydration
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const scriptSpy = vi.hoisted(() => vi.fn());

vi.mock("next/script", () => ({
  default: ({
    children,
    ...props
  }: React.PropsWithChildren<Record<string, unknown>>) => {
    scriptSpy({ ...props, inline: children ?? null });
    return <script data-testid="next-script" />;
  },
}));

import GoogleAnalytics from "@/components/GoogleAnalytics";

const MEASUREMENT_ID = "G-PXWNVQ8D1T";

afterEach(() => {
  cleanup();
  scriptSpy.mockClear();
});

describe("GoogleAnalytics", () => {
  it("loads gtag.js for the measurement ID after hydration", () => {
    render(<GoogleAnalytics />);

    expect(scriptSpy).toHaveBeenCalledTimes(2);
    const loader = scriptSpy.mock.calls.find(
      ([p]) => typeof p.src === "string"
    )![0];
    expect(loader.src).toBe(
      `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`
    );
    expect(loader.strategy).toBe("afterInteractive");
    expect(loader.inline).toBeNull();
  });

  it("initialises the dataLayer and configures page_view for the same ID", () => {
    render(<GoogleAnalytics />);

    const init = scriptSpy.mock.calls.find(([p]) => p.id === "ga4-init")![0];
    expect(init.strategy).toBe("afterInteractive");
    const snippet = String(init.inline);
    expect(snippet).toContain("window.dataLayer = window.dataLayer || []");
    expect(snippet).toContain(`gtag('config', '${MEASUREMENT_ID}'`);
    expect(snippet).toContain("page_path: window.location.pathname");
    expect(snippet).toContain("send_page_view: true");
  });
});
