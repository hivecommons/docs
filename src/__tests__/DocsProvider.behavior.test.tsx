// @vitest-environment jsdom
//
// Behavior tests for the docs chrome state layer and the two small widgets
// that drive it:
//  - DocsProvider: localStorage-backed banner dismissal, menu/sidebar toggles,
//    nav-folder collapse set, and the useDocsMenu outside-provider guard
//  - MobileHeader: breadcrumb derivation from the pathname and the
//    dismiss-banner-then-toggle wiring
//  - SidebarFooter: theme toggle in full and slim variants, mounted/unmounted
//    placeholders, and the isMobile collapse-button suppression
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";

let pathname = "/docs/hive/overview/introduction";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
}));

const setTheme = vi.fn();
let resolvedTheme: string | undefined = "light";
vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme }),
}));

import { DocsProvider, useDocsMenu } from "../components/docs/DocsProvider";
import { MobileHeader } from "../components/docs/MobileSidebarToggle";
import { SidebarFooter } from "../components/docs/SidebarFooter";

function Probe() {
  const ctx = useDocsMenu();
  return (
    <div>
      <span data-testid="menu">{String(ctx.menuOpen)}</span>
      <span data-testid="sidebar">{String(ctx.sidebarCollapsed)}</span>
      <span data-testid="banner">{String(ctx.bannerDismissed)}</span>
      <span data-testid="nav">{[...ctx.navCollapsed].sort().join(",")}</span>
      <span data-testid="init">{String(ctx.navInitialized.current)}</span>
      <button onClick={ctx.toggleMenu}>toggle-menu</button>
      <button onClick={() => ctx.setMenuOpen(true)}>open-menu</button>
      <button onClick={ctx.toggleSidebar}>toggle-sidebar</button>
      <button onClick={() => ctx.setSidebarCollapsed(true)}>
        collapse-sidebar
      </button>
      <button onClick={ctx.dismissBanner}>dismiss-banner</button>
      <button onClick={() => ctx.setBannerDismissed(false)}>
        restore-banner
      </button>
      <button onClick={() => ctx.toggleNavCollapsed("hive")}>nav-hive</button>
      <button onClick={() => ctx.toggleNavCollapsed("console")}>
        nav-console
      </button>
      <button onClick={() => ctx.setNavCollapsed(new Set(["x", "y"]))}>
        nav-set
      </button>
    </div>
  );
}

beforeEach(() => {
  pathname = "/docs/hive/overview/introduction";
  resolvedTheme = "light";
  setTheme.mockReset();
  localStorage.clear();
});

afterEach(() => {
  localStorage.clear();
});

describe("DocsProvider", () => {
  it("starts with closed menu, expanded sidebar, visible banner and empty nav set", () => {
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    expect(screen.getByTestId("menu").textContent).toBe("false");
    expect(screen.getByTestId("sidebar").textContent).toBe("false");
    expect(screen.getByTestId("banner").textContent).toBe("false");
    expect(screen.getByTestId("nav").textContent).toBe("");
    expect(screen.getByTestId("init").textContent).toBe("false");
  });

  it("reads a previously dismissed banner from localStorage on mount", () => {
    localStorage.setItem("docs-banner-dismissed", "true");
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    expect(screen.getByTestId("banner").textContent).toBe("true");
  });

  it("ignores a non-'true' localStorage value for the banner flag", () => {
    localStorage.setItem("docs-banner-dismissed", "yes");
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    expect(screen.getByTestId("banner").textContent).toBe("false");
  });

  it("dismissBanner flips state and persists the flag; setBannerDismissed does not persist", () => {
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    fireEvent.click(screen.getByText("dismiss-banner"));
    expect(screen.getByTestId("banner").textContent).toBe("true");
    expect(localStorage.getItem("docs-banner-dismissed")).toBe("true");

    fireEvent.click(screen.getByText("restore-banner"));
    expect(screen.getByTestId("banner").textContent).toBe("false");
    // The raw setter is an in-memory override only.
    expect(localStorage.getItem("docs-banner-dismissed")).toBe("true");
  });

  it("toggleMenu and setMenuOpen drive menuOpen", () => {
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    fireEvent.click(screen.getByText("toggle-menu"));
    expect(screen.getByTestId("menu").textContent).toBe("true");
    fireEvent.click(screen.getByText("toggle-menu"));
    expect(screen.getByTestId("menu").textContent).toBe("false");
    fireEvent.click(screen.getByText("open-menu"));
    expect(screen.getByTestId("menu").textContent).toBe("true");
  });

  it("toggleSidebar and setSidebarCollapsed drive sidebarCollapsed", () => {
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    fireEvent.click(screen.getByText("toggle-sidebar"));
    expect(screen.getByTestId("sidebar").textContent).toBe("true");
    fireEvent.click(screen.getByText("toggle-sidebar"));
    expect(screen.getByTestId("sidebar").textContent).toBe("false");
    fireEvent.click(screen.getByText("collapse-sidebar"));
    expect(screen.getByTestId("sidebar").textContent).toBe("true");
  });

  it("toggleNavCollapsed adds then removes keys without mutating the previous set", () => {
    render(
      <DocsProvider>
        <Probe />
      </DocsProvider>
    );
    fireEvent.click(screen.getByText("nav-hive"));
    expect(screen.getByTestId("nav").textContent).toBe("hive");
    fireEvent.click(screen.getByText("nav-console"));
    expect(screen.getByTestId("nav").textContent).toBe("console,hive");
    fireEvent.click(screen.getByText("nav-hive"));
    expect(screen.getByTestId("nav").textContent).toBe("console");
    fireEvent.click(screen.getByText("nav-set"));
    expect(screen.getByTestId("nav").textContent).toBe("x,y");
  });

  it("exposes a navInitialized ref that persists across re-renders", () => {
    function RefProbe() {
      const { navInitialized, toggleMenu } = useDocsMenu();
      return (
        <button
          onClick={() => {
            navInitialized.current = true;
            toggleMenu();
          }}
        >
          mark-{String(navInitialized.current)}
        </button>
      );
    }
    render(
      <DocsProvider>
        <RefProbe />
      </DocsProvider>
    );
    fireEvent.click(screen.getByText("mark-false"));
    expect(screen.getByText("mark-true")).toBeTruthy();
  });

  it("useDocsMenu throws a descriptive error outside a DocsProvider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(() => render(<Probe />)).toThrow(
        "useDocsMenu must be used within a DocsProvider"
      );
    } finally {
      spy.mockRestore();
    }
  });
});

describe("MobileHeader", () => {
  function renderHeader(onToggleSidebar = vi.fn()) {
    const utils = render(
      <DocsProvider>
        <MobileHeader onToggleSidebar={onToggleSidebar} />
        <Probe />
      </DocsProvider>
    );
    return { ...utils, onToggleSidebar };
  }

  it("renders the special-cased introduction breadcrumb", () => {
    pathname = "/docs/introduction";
    renderHeader();
    expect(screen.getByText("Docs > Guide")).toBeTruthy();
  });

  it("title-cases kebab- and snake-case path segments", () => {
    pathname = "/docs/console/getting-started/multi_cluster-setup";
    renderHeader();
    expect(
      screen.getByText("Docs > Console > Getting Started > Multi Cluster Setup")
    ).toBeTruthy();
  });

  it("falls back to 'Docs' when the pathname is not under /docs/", () => {
    pathname = "/blog/post";
    renderHeader();
    expect(screen.getByText("Docs")).toBeTruthy();
  });

  it("dismisses the banner and toggles the sidebar on click", () => {
    const { onToggleSidebar } = renderHeader();
    expect(screen.getByTestId("banner").textContent).toBe("false");

    fireEvent.click(screen.getByLabelText("Open sidebar"));

    expect(onToggleSidebar).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("banner").textContent).toBe("true");
    expect(localStorage.getItem("docs-banner-dismissed")).toBe("true");
  });
});

describe("SidebarFooter", () => {
  it("full variant: renders theme label and collapse button, toggles light -> dark", () => {
    const onCollapse = vi.fn();
    render(<SidebarFooter onCollapse={onCollapse} />);

    expect(screen.getByText("Light")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Change theme"));
    expect(setTheme).toHaveBeenCalledWith("dark");

    fireEvent.click(screen.getByTitle("Collapse sidebar"));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("full variant: shows Dark label and toggles dark -> light", () => {
    resolvedTheme = "dark";
    render(<SidebarFooter onCollapse={vi.fn()} />);

    expect(screen.getByText("Dark")).toBeTruthy();
    fireEvent.click(screen.getByTitle("Change theme"));
    expect(setTheme).toHaveBeenCalledWith("light");
  });

  it("full variant on mobile omits the collapse button", () => {
    render(<SidebarFooter onCollapse={vi.fn()} isMobile />);
    expect(screen.queryByTitle("Collapse sidebar")).toBeNull();
    expect(screen.getByTitle("Change theme")).toBeTruthy();
  });

  it("slim variant: icon-only expand button and theme toggle", () => {
    const onCollapse = vi.fn();
    resolvedTheme = "dark";
    render(<SidebarFooter onCollapse={onCollapse} variant="slim" />);

    expect(screen.queryByText("Dark")).toBeNull();
    fireEvent.click(screen.getByTitle("Change theme"));
    expect(setTheme).toHaveBeenCalledWith("light");

    fireEvent.click(screen.getByTitle("Expand sidebar"));
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });

  it("server-renders size-reserving placeholders (mount effect has not run)", () => {
    const full = renderToStaticMarkup(<SidebarFooter onCollapse={vi.fn()} />);
    expect(full).toContain('class="h-7 w-full"');
    expect(full).not.toContain("Change theme");

    const slim = renderToStaticMarkup(
      <SidebarFooter onCollapse={vi.fn()} variant="slim" />
    );
    expect(slim.match(/class="w-5 h-5"/g)?.length).toBe(2);
    expect(slim).not.toContain("Expand sidebar");
  });
});
