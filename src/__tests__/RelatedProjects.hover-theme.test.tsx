// @vitest-environment jsdom
//
// Complements RelatedProjects.behavior.test.tsx, which covers routing,
// config fallback and the Legacy tree. This file covers the arms that were
// still unexecuted in src/components/docs/RelatedProjects.tsx:
//  - hover highlighting (onMouseEnter/onMouseLeave) in all three lists:
//    active projects, general sections and secondary (Legacy) projects —
//    including the "hovering the current project is a no-op" guard
//  - dark-theme colour selection for current / hovered / idle rows and for
//    the muted Legacy rows
//  - bannerActive compact spacing on the wrapper and every row
//  - every pathname prefix arm of getCurrentProject()
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import type { SharedConfig } from "@/hooks/useSharedConfig";

let pathname = "/docs/hive";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

let resolvedTheme: string | undefined = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme: vi.fn() }),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} data-next-link="true" {...rest}>
      {children}
    </a>
  ),
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

import { RelatedProjects } from "@/components/docs/RelatedProjects";

const projects = [
  { title: "Hive", href: "/docs/hive" },
  { title: "pluk", href: "/docs/pluk" },
  { title: "Old Thing", href: "/docs/old-thing", secondary: true },
  { title: "Older Thing", href: "/docs/older-thing", secondary: true },
];

const community = { title: "Community", href: "/docs/community" };
const news = { title: "News", href: "/docs/news" };

const LIGHT_CURRENT_BG = "rgba(239, 246, 255, 1)";
const LIGHT_HOVER_BG = "rgba(243, 244, 246, 1)";
const DARK_CURRENT_BG = "rgba(59, 130, 246, 0.2)";
const DARK_HOVER_BG = "rgba(55, 65, 81, 0.6)";

// jsdom normalises inline rgba() colours to rgb()/rgba() with spaces; compare
// through the same normaliser so the assertions stay style-engine agnostic.
function bg(el: HTMLElement): string {
  return el.style.backgroundColor;
}
function norm(v: string): string {
  const probe = document.createElement("div");
  probe.style.backgroundColor = v;
  return probe.style.backgroundColor;
}
function normColor(v: string): string {
  const probe = document.createElement("div");
  probe.style.color = v;
  return probe.style.color;
}

beforeEach(() => {
  pathname = "/docs/hive";
  resolvedTheme = "light";
  useSharedConfigMock.mockReturnValue({
    config: {
      versions: {},
      projects: {},
      relatedProjects: projects,
      editBaseUrls: {},
      updatedAt: "2026-01-01T00:00:00Z",
    },
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("hover highlighting", () => {
  it("highlights a non-current project on mouse enter and clears it on leave", () => {
    render(<RelatedProjects />);
    const pluk = screen.getByText("pluk");
    expect(bg(pluk)).toBe("");

    fireEvent.mouseEnter(pluk);
    expect(bg(pluk)).toBe(norm(LIGHT_HOVER_BG));

    fireEvent.mouseLeave(pluk);
    expect(bg(pluk)).toBe("");
  });

  it("does not change the current project's background on hover", () => {
    render(<RelatedProjects />);
    const hive = screen.getByText("Hive");
    expect(bg(hive)).toBe(norm(LIGHT_CURRENT_BG));

    fireEvent.mouseEnter(hive);
    expect(bg(hive)).toBe(norm(LIGHT_CURRENT_BG));

    // Hovering the current row must not have marked it as the hovered one:
    // leaving it leaves every other row idle too.
    fireEvent.mouseLeave(hive);
    expect(bg(screen.getByText("pluk"))).toBe("");
  });

  it("highlights a non-current general section and ignores the current one", () => {
    pathname = "/docs/community";
    render(<RelatedProjects generalSections={[community, news]} />);
    const current = screen.getByText("Community");
    const other = screen.getByText("News");

    expect(bg(current)).toBe(norm(LIGHT_CURRENT_BG));
    fireEvent.mouseEnter(current);
    expect(bg(current)).toBe(norm(LIGHT_CURRENT_BG));
    fireEvent.mouseLeave(current);

    fireEvent.mouseEnter(other);
    expect(bg(other)).toBe(norm(LIGHT_HOVER_BG));
    fireEvent.mouseLeave(other);
    expect(bg(other)).toBe("");
  });

  it("highlights a non-current Legacy project and ignores the current one", () => {
    pathname = "/docs/anything";
    render(<RelatedProjects autoExpandLegacy />);
    const old = screen.getByText("Old Thing");
    const older = screen.getByText("Older Thing");

    fireEvent.mouseEnter(old);
    expect(bg(old)).toBe(norm(LIGHT_HOVER_BG));
    expect(bg(older)).toBe("");
    fireEvent.mouseLeave(old);
    expect(bg(old)).toBe("");
  });

  it("keeps the current Legacy project highlighted and non-hoverable", () => {
    // Legacy rows are only "current" when getCurrentProject() returns their
    // title; the Hive fallback does that for a secondary project named Hive.
    useSharedConfigMock.mockReturnValue({
      config: {
        versions: {},
        projects: {},
        relatedProjects: [
          { title: "pluk", href: "/docs/pluk" },
          { title: "Hive", href: "/docs/legacy-hive", secondary: true },
        ],
        editBaseUrls: {},
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    pathname = "/docs/unknown";
    render(<RelatedProjects autoExpandLegacy />);
    const hive = screen.getByText("Hive");
    expect(hive.className).toContain("font-medium");
    expect(bg(hive)).toBe(norm(LIGHT_CURRENT_BG));

    fireEvent.mouseEnter(hive);
    expect(bg(hive)).toBe(norm(LIGHT_CURRENT_BG));
    fireEvent.mouseLeave(hive);
    expect(bg(screen.getByText("pluk"))).toBe("");
  });
});

describe("dark theme colours", () => {
  it("uses the dark palette for current, hovered and idle project rows", async () => {
    resolvedTheme = "dark";
    render(<RelatedProjects />);
    // isDark requires mounted; wait for the effect to flip it.
    const hive = screen.getByText("Hive");
    await vi.waitFor(() =>
      expect(bg(hive)).toBe(norm(DARK_CURRENT_BG))
    );
    expect(hive.style.color).toBe(normColor("#60a5fa"));

    const pluk = screen.getByText("pluk");
    expect(pluk.style.color).toBe(normColor("#e5e7eb"));
    expect(bg(pluk)).toBe("");
    fireEvent.mouseEnter(pluk);
    expect(bg(pluk)).toBe(norm(DARK_HOVER_BG));
  });

  it("uses the dark palette for general sections and muted Legacy rows", async () => {
    resolvedTheme = "dark";
    pathname = "/docs/news";
    render(
      <RelatedProjects generalSections={[community, news]} autoExpandLegacy />
    );
    const newsEl = screen.getByText("News");
    await vi.waitFor(() =>
      expect(bg(newsEl)).toBe(norm(DARK_CURRENT_BG))
    );

    const communityEl = screen.getByText("Community");
    fireEvent.mouseEnter(communityEl);
    expect(bg(communityEl)).toBe(norm(DARK_HOVER_BG));

    const old = screen.getByText("Old Thing");
    expect(old.style.color).toBe(normColor("#9ca3af"));
    fireEvent.mouseEnter(old);
    expect(bg(old)).toBe(norm(DARK_HOVER_BG));
    fireEvent.mouseLeave(old);
    expect(bg(old)).toBe("");
  });
});

describe("bannerActive compact spacing", () => {
  it("tightens wrapper, list, row and Legacy spacing when the banner is shown", () => {
    const { container } = render(
      <RelatedProjects bannerActive generalSections={[community]} autoExpandLegacy />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("py-1");
    expect(wrapper.className).not.toContain("pt-4");

    const list = wrapper.firstElementChild as HTMLElement;
    expect(list.className).toContain("space-y-0");

    for (const title of ["Hive", "pluk", "Community", "Old Thing"]) {
      expect(screen.getByText(title).className).toContain("py-0.5");
    }

    const legacyWrapper = screen.getByText("Legacy").closest("button")
      ?.parentElement as HTMLElement;
    expect(legacyWrapper.className).toContain("mt-0");
  });

  it("uses the roomy spacing by default", () => {
    const { container } = render(
      <RelatedProjects generalSections={[community]} autoExpandLegacy />
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("pt-4 pb-2");
    expect((wrapper.firstElementChild as HTMLElement).className).toContain(
      "space-y-1.5"
    );
    expect(screen.getByText("Hive").className).toContain("py-2");
    expect(screen.getByText("Old Thing").className).toContain("py-2");
  });
});

describe("getCurrentProject pathname arms", () => {
  const arms: Array<[string, string]> = [
    ["/docs/hotshot/install", "hotshot"],
    ["/docs/a2a", "A2A"],
    ["/docs/kubeflex/overview", "KubeFlex"],
    ["/docs/multi-plugin", "Multi Plugin"],
    ["/docs/pluk", "pluk"],
    ["/docs/spektacular/x", "Spektacular"],
    ["/docs/contributing", "Contributing"],
    ["/docs/community/meetings", "Community"],
    ["/docs/news/2026", "News"],
    ["/docs", "Hive"],
  ];

  it.each(arms)("maps %s to the %s entry", (path, title) => {
    pathname = path;
    useSharedConfigMock.mockReturnValue({
      config: {
        versions: {},
        projects: {},
        relatedProjects: arms.map(([, t]) => ({
          title: t,
          href: `/docs/${t.toLowerCase().replace(" ", "-")}`,
        })),
        editBaseUrls: {},
        updatedAt: "2026-01-01T00:00:00Z",
      },
    });
    render(<RelatedProjects />);
    const highlighted = screen
      .getAllByRole("link")
      .filter(el => el.className.includes("font-medium"));
    expect(highlighted.map(el => el.textContent)).toEqual([title]);
  });
});
