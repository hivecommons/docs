// @vitest-environment jsdom
//
// Covers src/components/docs/VersionSelector.tsx (previously 0%):
//  - version sorting (default first, dev next, numeric descending, legacy last)
//  - hostname-based current-version detection (production, netlify branch
//    deploys, main deploy, deploy previews, unknown hosts)
//  - navigation on selection (production URL, netlify branch-deploy URL,
//    external URL)
//  - dropdown close on Escape and outside mousedown
//  - sort tie-breaks when the default/dev/legacy entries arrive out of order
//  - fallbacks when no version is marked default (key 'latest', then the
//    project's static currentVersion label)
//  - mobile variant dark-palette highlight of the current version
import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { SharedConfig } from "@/hooks/useSharedConfig";

let pathname = "/docs/hive/overview";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

let resolvedTheme = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme }),
}));

const useSharedConfigMock = vi.fn<() => { config: SharedConfig | null }>(
  () => ({ config: null })
);

vi.mock("@/hooks/useSharedConfig", async importOriginal => {
  const actual =
    await importOriginal<typeof import("@/hooks/useSharedConfig")>();
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

function sharedConfig(
  versions: Record<string, unknown> = HIVE_TEST_VERSIONS
): SharedConfig {
  return {
    versions: { hive: versions },
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
  resolvedTheme = "light";
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
    const labels = screen.getAllByRole("option").map(o => o.textContent);
    expect(labels).toEqual([
      "v5 (Latest)",
      "main (dev)",
      "v0.28.0",
      "v0.9.0",
      "Legacy",
    ]);
  });

  it("sorts the same way when default, dev and legacy arrive in reverse order", () => {
    // Object.entries order feeds the sort, so an out-of-order config exercises
    // the comparator arms where `b` (not `a`) is the default/dev/legacy entry.
    useSharedConfigMock.mockReturnValue({
      config: sharedConfig({
        legacy: HIVE_TEST_VERSIONS.legacy,
        "0.9.0": HIVE_TEST_VERSIONS["0.9.0"],
        "0.28.0": HIVE_TEST_VERSIONS["0.28.0"],
        main: HIVE_TEST_VERSIONS.main,
        latest: HIVE_TEST_VERSIONS.latest,
      }),
    });
    render(<VersionSelector />);
    openDropdown();
    const labels = screen.getAllByRole("option").map(o => o.textContent);
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

describe("no version marked default", () => {
  it("treats the 'latest' key as current when nothing is marked default", () => {
    useSharedConfigMock.mockReturnValue({
      config: sharedConfig({
        "0.28.0": HIVE_TEST_VERSIONS["0.28.0"],
        latest: { label: "v5 (Latest)", branch: "docs/v5" },
      }),
    });
    render(<VersionSelector />);
    openDropdown();
    const current = screen.getByRole("option", { name: "v5 (Latest)" });
    expect(current.getAttribute("aria-selected")).toBe("true");
  });

  it("shows the project's static version label when no 'latest' key exists either", () => {
    useSharedConfigMock.mockReturnValue({
      config: sharedConfig({
        "0.28.0": HIVE_TEST_VERSIONS["0.28.0"],
        "0.9.0": HIVE_TEST_VERSIONS["0.9.0"],
      }),
    });
    render(<VersionSelector />);
    // Static hive project config carries currentVersion "v5".
    const trigger = screen.getByRole("button", {
      name: /select hive documentation version/i,
    });
    expect(trigger.textContent).toContain("v5");
    openDropdown();
    for (const option of screen.getAllByRole("option")) {
      expect(option.getAttribute("aria-selected")).toBe("false");
    }
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

  it("uses the dark palette for the desktop trigger, listbox and options", () => {
    resolvedTheme = "dark";
    render(<VersionSelector />);
    const trigger = screen.getByRole("button", {
      name: /select hive documentation version/i,
    });
    expect(trigger.className).toContain("bg-bg-3/50");
    openDropdown();
    expect(screen.getByRole("listbox").className).toContain(
      "bg-bg-2 border-line"
    );
    const current = screen.getByRole("option", { name: "v5 (Latest)" });
    expect(current.className).toContain("bg-bg-3 text-ink font-medium");
    const other = screen.getByRole("option", { name: "v0.28.0" });
    expect(other.className).toContain("hover:bg-bg-3");
    expect(other.className).not.toContain("font-medium");
  });

  it("highlights the current version with the dark palette on mobile", () => {
    resolvedTheme = "dark";
    render(<VersionSelector isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /version:/i }));
    const current = screen.getByText("v5 (Latest)");
    expect(current.className).toContain("bg-bg-3");
    expect(current.className).toContain("font-medium");
    const other = screen.getByText("v0.28.0");
    expect(other.className).toContain("text-ink-3");
    expect(other.className).not.toContain("font-medium");
  });

  it("highlights the current version with the light palette on mobile", () => {
    render(<VersionSelector isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /version:/i }));
    const current = screen.getByText("v5 (Latest)");
    expect(current.className).toContain("bg-bg-2");
    const other = screen.getByText("v0.28.0");
    expect(other.className).toContain("text-ink-2");
  });

  it("navigates from the mobile list the same way as the desktop dropdown", () => {
    render(<VersionSelector isMobile />);
    fireEvent.click(screen.getByRole("button", { name: /version:/i }));
    fireEvent.click(screen.getByText("v0.9.0"));
    expect(window.location.href).toBe(
      "https://docs-0-9-0--hivecommons-docs.netlify.app/docs/hive/overview"
    );
  });
});
