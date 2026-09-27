// @vitest-environment jsdom
//
// Covers src/components/docs/VersionSelector.tsx (previously 0%):
//  - version sorting (default first, dev next, numeric descending, legacy last)
//  - hostname-based current-version detection (production, netlify branch
//    deploys, main deploy, deploy previews, unknown hosts)
//  - navigation on selection (production URL, netlify branch-deploy URL,
//    external URL)
//  - dropdown close on Escape and outside mousedown
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { SharedConfig } from "@/hooks/useSharedConfig";

let pathname = "/docs/hive/overview";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
}));

const useSharedConfigMock = vi.fn<() => { config: SharedConfig | null }>(
  () => ({ config: null })
);

vi.mock("@/hooks/useSharedConfig", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/useSharedConfig")>();
  return {
    ...actual,
    useSharedConfig: () => useSharedConfigMock(),
  };
});

import VersionSelector from "@/components/docs/VersionSelector";

const HIVE_TEST_VERSIONS = {
  latest: { label: "v5 (Latest)", branch: "docs/v5", isDefault: true },
  main: { label: "main (dev)", branch: "main", isDev: true },
  "0.28.0": { label: "v0.28.0", branch: "docs/0.28.0" },
  "0.9.0": { label: "v0.9.0", branch: "docs/0.9.0" },
  legacy: {
    label: "Legacy",
    branch: "legacy",
    externalUrl: "https://legacy.example.com/docs",
  },
};

function sharedConfig(): SharedConfig {
  return {
    versions: { hive: HIVE_TEST_VERSIONS },
    editBaseUrls: {},
    projects: {},
  } as unknown as SharedConfig;
}

const realLocation = window.location;

function stubLocation(hostname: string) {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: { hostname, href: "" } as unknown as Location,
  });
}

function openDropdown() {
  fireEvent.click(
    screen.getByRole("button", {
      name: /select hive documentation version/i,
    })
  );
}

beforeEach(() => {
  cleanup();
  pathname = "/docs/hive/overview";
  useSharedConfigMock.mockReset();
  useSharedConfigMock.mockReturnValue({ config: sharedConfig() });
  stubLocation("docs.hivecommons.dev");
});

afterEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    writable: true,
    value: realLocation,
  });
});

describe("version list", () => {
  it("sorts default first, dev next, numeric descending, legacy last", () => {
    render(<VersionSelector />);
    openDropdown();
    const labels = screen
      .getAllByRole("option")
      .map((o) => o.textContent);
    expect(labels).toEqual([
      "v5 (Latest)",
      "main (dev)",
      "v0.28.0",
      "v0.9.0",
      "Legacy",
    ]);
  });

  it("falls back to static config when shared config is unavailable", () => {
    useSharedConfigMock.mockReturnValue({ config: null });
    render(<VersionSelector />);
    openDropdown();
    // Static hive config always contains at least the default version.
    expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  });
});

describe("hostname-based current version detection", () => {
  it("selects the default version on the production host", () => {
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "v5 (Latest)" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });

  it("matches a netlify branch deploy to its version", () => {
    stubLocation("docs-0-28-0--hivecommons-docs.netlify.app");
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "v0.28.0" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });

  it("selects the main version on the main branch deploy", () => {
    stubLocation("main--hivecommons-docs.netlify.app");
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "main (dev)" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });

  it("falls back to the default version on deploy previews", () => {
    stubLocation("deploy-preview-42--hivecommons-docs.netlify.app");
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "v5 (Latest)" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });

  it("falls back to the default version on unknown hosts", () => {
    stubLocation("localhost");
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "v5 (Latest)" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });
});

describe("navigation on selection", () => {
  it("sends the default version to the production URL", () => {
    render(<VersionSelector />);
    openDropdown();
    fireEvent.click(screen.getByRole("option", { name: "v5 (Latest)" }));
    expect(window.location.href).toBe(
      "https://docs.hivecommons.dev/docs/hive/overview"
    );
  });

  it("sends other versions to their netlify branch deploy", () => {
    render(<VersionSelector />);
    openDropdown();
    fireEvent.click(screen.getByRole("option", { name: "v0.9.0" }));
    expect(window.location.href).toBe(
      "https://docs-0-9-0--hivecommons-docs.netlify.app/docs/hive/overview"
    );
  });

  it("sends external versions to their external URL", () => {
    render(<VersionSelector />);
    openDropdown();
    fireEvent.click(screen.getByRole("option", { name: "Legacy" }));
    expect(window.location.href).toBe("https://legacy.example.com/docs");
  });
});

describe("dropdown dismissal", () => {
  it("closes on Escape", () => {
    render(<VersionSelector />);
    openDropdown();
    expect(screen.queryAllByRole("option").length).toBeGreaterThan(0);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("closes on mousedown outside the dropdown", () => {
    render(<VersionSelector />);
    openDropdown();
    expect(screen.queryAllByRole("option").length).toBeGreaterThan(0);
    fireEvent.mouseDown(document.body);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("stays open on mousedown inside the dropdown", () => {
    render(<VersionSelector />);
    openDropdown();
    fireEvent.mouseDown(screen.getByRole("listbox"));
    expect(screen.queryAllByRole("option").length).toBeGreaterThan(0);
  });

  it("renders the mobile variant as an expandable list", () => {
    render(<VersionSelector isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /version:/i }));
    expect(screen.getByText("v0.28.0")).toBeTruthy();
  });
});
