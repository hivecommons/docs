// @vitest-environment jsdom
//
// The Kapa "Ask AI" widget must stay off unless NEXT_PUBLIC_KAPA_WEBSITE_ID is
// set, and the CSP must only gain the Kapa hosts in that case. The default
// build is the one that ships today, so pin it.
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

const scriptSpy = vi.hoisted(() => vi.fn());

vi.mock("next/script", () => ({
  default: (props: Record<string, unknown>) => {
    scriptSpy(props);
    return <script data-testid="next-script" />;
  },
}));
vi.mock("nextra", () => ({ default: () => (config: unknown) => config }));
vi.mock("next-intl/plugin", () => ({
  default: () => (config: unknown) => config,
}));

import KapaWidget from "@/components/KapaWidget";
import { KAPA_CSP_SOURCES, getKapaWebsiteId } from "@/lib/kapa";

afterEach(() => {
  cleanup();
  scriptSpy.mockClear();
  vi.unstubAllEnvs();
  vi.resetModules();
});

async function loadCsp(): Promise<string> {
  const { default: config } = await import("../../next.config");
  const rules = await config.headers!();
  return rules[0].headers.find(h => h.key === "Content-Security-Policy")!.value;
}

describe("getKapaWebsiteId", () => {
  it("is undefined when unset or blank", () => {
    expect(getKapaWebsiteId({})).toBeUndefined();
    expect(getKapaWebsiteId({ NEXT_PUBLIC_KAPA_WEBSITE_ID: "  " })).toBe(
      undefined
    );
  });

  it("returns the trimmed ID", () => {
    expect(getKapaWebsiteId({ NEXT_PUBLIC_KAPA_WEBSITE_ID: " abc " })).toBe(
      "abc"
    );
  });
});

describe("KapaWidget", () => {
  it("renders no script by default", () => {
    vi.stubEnv("NEXT_PUBLIC_KAPA_WEBSITE_ID", "");
    render(<KapaWidget />);
    expect(scriptSpy).not.toHaveBeenCalled();
  });

  it("loads the widget with the public website ID when enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_KAPA_WEBSITE_ID", "test-id");
    render(<KapaWidget />);
    expect(scriptSpy).toHaveBeenCalledTimes(1);
    const props = scriptSpy.mock.calls[0][0];
    expect(props.src).toBe("https://widget.kapa.ai/kapa-widget.bundle.js");
    expect(props["data-website-id"]).toBe("test-id");
    expect(props.strategy).toBe("afterInteractive");
  });
});

describe("Kapa CSP allowances", () => {
  it("leaves the policy free of Kapa hosts by default", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAPA_WEBSITE_ID", "");
    expect(await loadCsp()).not.toContain("kapa");
  });

  it("adds the documented hosts when the flag is set", async () => {
    vi.stubEnv("NEXT_PUBLIC_KAPA_WEBSITE_ID", "test-id");
    const csp = await loadCsp();
    for (const [directive, hosts] of Object.entries(KAPA_CSP_SOURCES)) {
      const value = csp
        .split(";")
        .map(d => d.trim())
        .find(d => d.startsWith(`${directive} `))!;
      for (const host of hosts) expect(value).toContain(host);
    }
    expect(csp).not.toContain("'unsafe-eval'");
  });
});
