// @vitest-environment jsdom
//
// Covers the small Next.js app shells and docs-chrome wrappers that were at 0%:
//  - src/app/[locale]/page.tsx: the locale root redirects straight to /docs
//  - src/app/docs/page.tsx: /docs redirects to the canonical landing doc and
//    is pinned to `dynamic = "force-static"`
//  - src/app/[locale]/not-found.tsx and src/app/not-found.tsx: render only the
//    self-contained NotFoundUI — never Navbar / GridLines / StarField, which
//    depend on Tailwind CSS that can 404 during deploy propagation; the root
//    variant resolves locale + messages and wraps NotFoundUI in the intl
//    provider
//  - MobileOverlay: hidden while the menu is closed, click closes the menu
//  - SidebarContainer: forwards pageMap/projectId to DocsSidebar unchanged
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

const {
  redirect,
  getLocale,
  getMessages,
  providerSpy,
  chromeSpy,
  useDocsMenu,
  docsSidebarSpy,
} = vi.hoisted(() => ({
  redirect: vi.fn(),
  getLocale: vi.fn(),
  getMessages: vi.fn(),
  providerSpy: vi.fn(),
  chromeSpy: vi.fn(),
  useDocsMenu: vi.fn(),
  docsSidebarSpy: vi.fn(),
}));

vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next-intl/server", () => ({ getLocale, getMessages }));
vi.mock("next-intl", () => ({
  NextIntlClientProvider: ({
    locale,
    messages,
    children,
  }: React.PropsWithChildren<{ locale: string; messages: unknown }>) => {
    providerSpy({ locale, messages });
    return <div data-testid="intl-provider">{children}</div>;
  },
}));
vi.mock("@/components/NotFoundUI", () => ({
  default: () => <div data-testid="not-found-ui" />,
}));
// Any render of the CSS-dependent chrome from a 404 page is a regression;
// make it loud by recording the call rather than silently rendering.
vi.mock("@/components/index", () => ({
  GridLines: () => {
    chromeSpy("GridLines");
    return null;
  },
  StarField: () => {
    chromeSpy("StarField");
    return null;
  },
  Navbar: () => {
    chromeSpy("Navbar");
    return null;
  },
}));
vi.mock("@/components/docs/DocsProvider", () => ({
  useDocsMenu: () => useDocsMenu(),
}));
vi.mock("@/components/docs/DocsSidebar", () => ({
  DocsSidebar: (props: Record<string, unknown>) => {
    docsSidebarSpy(props);
    return <nav data-testid="docs-sidebar" />;
  },
}));

import Home from "@/app/[locale]/page";
import DocsPage, { dynamic } from "@/app/docs/page";
import LocaleNotFound from "@/app/[locale]/not-found";
import NotFound from "@/app/not-found";
import { MobileOverlay } from "@/components/docs/MobileOverlay";
import { SidebarContainer } from "@/components/docs/SidebarContainer";

beforeEach(() => {
  redirect.mockReset();
  getLocale.mockReset().mockResolvedValue("de");
  getMessages.mockReset().mockResolvedValue({ hello: "hallo" });
  providerSpy.mockReset();
  chromeSpy.mockReset();
  useDocsMenu.mockReset();
  docsSidebarSpy.mockReset();
});

afterEach(() => {
  cleanup();
});

describe("redirect shells", () => {
  it("[locale]/page.tsx sends the locale root to /docs", () => {
    Home();
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith("/docs");
  });

  it("docs/page.tsx sends /docs to the canonical landing doc and is force-static", () => {
    DocsPage();
    expect(redirect).toHaveBeenCalledTimes(1);
    expect(redirect).toHaveBeenCalledWith(
      "/docs/community/what-is-hive-commons"
    );
    expect(dynamic).toBe("force-static");
  });
});

describe("404 shells", () => {
  it("[locale]/not-found.tsx renders only the self-contained NotFoundUI", () => {
    const { container } = render(<LocaleNotFound />);
    expect(screen.getByTestId("not-found-ui")).toBeTruthy();
    expect(container.children).toHaveLength(1);
    expect(chromeSpy).not.toHaveBeenCalled();
    expect(providerSpy).not.toHaveBeenCalled();
  });

  it("not-found.tsx resolves locale + messages and wraps NotFoundUI in the intl provider", async () => {
    const tree = await NotFound();
    render(tree);

    expect(getLocale).toHaveBeenCalledTimes(1);
    expect(getMessages).toHaveBeenCalledTimes(1);
    expect(providerSpy).toHaveBeenCalledWith({
      locale: "de",
      messages: { hello: "hallo" },
    });
    const provider = screen.getByTestId("intl-provider");
    expect(
      provider.querySelector('[data-testid="not-found-ui"]')
    ).not.toBeNull();
    expect(chromeSpy).not.toHaveBeenCalled();
  });

  it("not-found.tsx propagates a failing getMessages instead of rendering unlocalised", async () => {
    getMessages.mockRejectedValueOnce(new Error("no messages"));
    await expect(NotFound()).rejects.toThrow("no messages");
    expect(providerSpy).not.toHaveBeenCalled();
  });
});

describe("MobileOverlay", () => {
  it("renders nothing while the menu is closed", () => {
    const toggleMenu = vi.fn();
    useDocsMenu.mockReturnValue({ menuOpen: false, toggleMenu });
    const { container } = render(<MobileOverlay />);
    expect(container.innerHTML).toBe("");
    expect(toggleMenu).not.toHaveBeenCalled();
  });

  it("renders a full-screen scrim that toggles the menu on click", () => {
    const toggleMenu = vi.fn();
    useDocsMenu.mockReturnValue({ menuOpen: true, toggleMenu });
    const { container } = render(<MobileOverlay />);
    const scrim = container.firstElementChild as HTMLElement;
    expect(scrim).not.toBeNull();
    expect(scrim.className).toContain("fixed");
    expect(scrim.className).toContain("inset-0");
    expect(scrim.className).toContain("lg:hidden");

    fireEvent.click(scrim);
    expect(toggleMenu).toHaveBeenCalledTimes(1);
  });
});

describe("SidebarContainer", () => {
  it("forwards pageMap and projectId to DocsSidebar unchanged", () => {
    const pageMap = [
      { name: "intro", route: "/docs/hive/intro", title: "Intro" },
      { name: "guides", children: [{ name: "a", route: "/docs/hive/a" }] },
    ];
    render(<SidebarContainer pageMap={pageMap} projectId="hive" />);
    expect(screen.getByTestId("docs-sidebar")).toBeTruthy();
    expect(docsSidebarSpy).toHaveBeenCalledTimes(1);
    const props = docsSidebarSpy.mock.calls[0][0];
    expect(props.pageMap).toBe(pageMap);
    expect(props.projectId).toBe("hive");
    expect(props.className).toBeUndefined();
  });
});
