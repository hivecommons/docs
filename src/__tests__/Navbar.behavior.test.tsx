// @vitest-environment jsdom
//
// Covers src/components/Navbar.tsx and its navbar/ hooks (previously 0% /
// partially covered):
//  - top-level links: Docs routes to /docs, Live Demo is external with
//    target="_blank" + rel="noopener noreferrer"
//  - hover dropdowns (useNavDropdowns): contribute/community/github menus are
//    hidden until mouseenter, opening one closes the others, aria-expanded
//    tracks the open menu, mouseleave hides after DROPDOWN_HIDE_DELAY_MS,
//    and Escape closes everything
//  - GitHub stats (useGithubStats): shields.io values replace the static
//    defaults on success and the defaults survive fetch failures
//  - mobile menu button toggles the menu and its aria-label
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import { DROPDOWN_HIDE_DELAY_MS } from "@/components/navbar/useHoverDropdown";

vi.mock("@/components/index", () => ({
  GridLines: () => <div data-testid="grid-lines" />,
  StarField: () => <div data-testid="star-field" />,
  LanguageSwitcher: () => (
    <button type="button" data-testid="language-switcher">
      lang
    </button>
  ),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.PropsWithChildren<{ href: string } & Record<string, unknown>>) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: (props: { src: string; alt: string }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={props.src} alt={props.alt} />
  ),
}));

vi.mock("next-intl", async () => {
  const messages = (await import("../../messages/en.json")).default as {
    navigation: Record<string, string>;
  };
  return {
    useTranslations: (ns: string) => (key: string) =>
      ns === "navigation" ? (messages.navigation[key] ?? key) : key,
  };
});

import Navbar from "@/components/Navbar";

// Renders the navbar and flushes the useGithubStats fetch state update so
// tests do not race it (avoids "not wrapped in act" warnings).
async function renderNavbar() {
  const result = render(<Navbar />);
  await act(async () => {});
  return result;
}

function dropdownContainer(name: string): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-dropdown="${name}"]`);
  if (!el) throw new Error(`missing dropdown container ${name}`);
  return el;
}

function dropdownMenu(name: string): HTMLElement {
  const menu = dropdownContainer(name).querySelector<HTMLElement>(
    "[data-dropdown-menu]"
  );
  if (!menu) throw new Error(`missing dropdown menu ${name}`);
  return menu;
}

function mockFetchWith(values: Record<string, string>) {
  return vi.fn(async (url: string | URL) => {
    const u = String(url);
    const metric = Object.keys(values).find(m => u.includes(`/${m}/`));
    if (!metric) return { ok: false, json: async () => ({}) };
    return { ok: true, json: async () => ({ value: values[metric] }) };
  });
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    mockFetchWith({ stars: "999", forks: "888", watchers: "777" })
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Navbar top-level links", () => {
  it("routes Docs to /docs and opens the Live Demo externally", async () => {
    await renderNavbar();

    const docsLinks = screen
      .getAllByRole("link")
      .filter(a => a.getAttribute("href") === "/docs");
    expect(docsLinks.length).toBeGreaterThan(0);

    const demo = screen
      .getAllByRole("link")
      .filter(a => a.getAttribute("href") === "https://hivecommons.dev");
    expect(demo.length).toBeGreaterThan(0);
    for (const a of demo) {
      expect(a.getAttribute("target")).toBe("_blank");
      expect(a.getAttribute("rel")).toBe("noopener noreferrer");
    }
  });
});

describe("Navbar hover dropdowns", () => {
  it("starts with every dropdown menu hidden and aria-expanded=false", async () => {
    await renderNavbar();
    for (const name of ["contribute", "community", "github"]) {
      expect(dropdownMenu(name).style.display).toBe("none");
    }
    for (const button of document.querySelectorAll("[aria-haspopup]")) {
      expect(button.getAttribute("aria-expanded")).toBe("false");
    }
  });

  it("opens a menu on mouseenter, flips aria-expanded, and closes the others", async () => {
    await renderNavbar();

    fireEvent.mouseEnter(dropdownContainer("contribute"));
    expect(dropdownMenu("contribute").style.display).toBe("block");
    expect(
      dropdownContainer("contribute")
        .querySelector("[data-dropdown-button]")
        ?.getAttribute("aria-expanded")
    ).toBe("true");

    // Opening community closes contribute.
    fireEvent.mouseEnter(dropdownContainer("community"));
    expect(dropdownMenu("community").style.display).toBe("block");
    expect(dropdownMenu("contribute").style.display).toBe("none");
    expect(
      dropdownContainer("contribute")
        .querySelector("[data-dropdown-button]")
        ?.getAttribute("aria-expanded")
    ).toBe("false");
  });

  it("hides the menu after the shared hide delay on mouseleave", async () => {
    await renderNavbar();

    fireEvent.mouseEnter(dropdownContainer("github"));
    expect(dropdownMenu("github").style.display).toBe("block");

    fireEvent.mouseLeave(dropdownContainer("github"));
    // Still visible before the delay elapses.
    expect(dropdownMenu("github").style.display).toBe("block");

    await waitFor(
      () => expect(dropdownMenu("github").style.display).toBe("none"),
      { timeout: DROPDOWN_HIDE_DELAY_MS + 1000 }
    );
  });

  it("re-entering the menu cancels the pending hide", async () => {
    await renderNavbar();

    fireEvent.mouseEnter(dropdownContainer("contribute"));
    fireEvent.mouseLeave(dropdownContainer("contribute"));
    fireEvent.mouseEnter(dropdownMenu("contribute"));

    await new Promise(r => setTimeout(r, DROPDOWN_HIDE_DELAY_MS + 100));
    expect(dropdownMenu("contribute").style.display).toBe("block");
  });

  it("closes every dropdown on Escape", async () => {
    await renderNavbar();

    fireEvent.mouseEnter(dropdownContainer("community"));
    expect(dropdownMenu("community").style.display).toBe("block");

    fireEvent.keyDown(document, { key: "Escape" });
    for (const name of ["contribute", "community", "github"]) {
      expect(dropdownMenu(name).style.display).toBe("none");
    }
    expect(
      dropdownContainer("community")
        .querySelector("[data-dropdown-button]")
        ?.getAttribute("aria-expanded")
    ).toBe("false");
  });
});

describe("Navbar GitHub stats", () => {
  it("replaces the static defaults with shields.io values", async () => {
    render(<Navbar />);
    await waitFor(() => {
      expect(screen.getAllByText("999").length).toBeGreaterThan(0);
      expect(screen.getAllByText("888").length).toBeGreaterThan(0);
      expect(screen.getAllByText("777").length).toBeGreaterThan(0);
    });
  });

  it("keeps the defaults when every shields.io fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    render(<Navbar />);
    // Defaults render immediately and are never replaced.
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("25").length).toBeGreaterThan(0);
    await act(async () => {
      await new Promise(r => setTimeout(r, 50));
    });
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
  });

  it("does not let a click on the repo link propagate past the React root", async () => {
    await renderNavbar();
    const container = dropdownContainer("github");
    const trigger = container.querySelector<HTMLElement>(
      "[data-dropdown-button]"
    )!;
    const repoLink = trigger.querySelector<HTMLAnchorElement>(
      'a[href="https://github.com/hivecommons/hive"]'
    )!;
    expect(repoLink.target).toBe("_blank");
    expect(repoLink.rel).toBe("noopener noreferrer");

    // React delegates to the root, so a synthetic stopPropagation is only
    // observable above it: document-level outside-click handlers must never
    // see a navigation click on the repo link as a dropdown interaction.
    const documentClick = vi.fn();
    document.addEventListener("click", documentClick);
    try {
      fireEvent.click(repoLink);
      expect(documentClick).not.toHaveBeenCalled();

      // Sanity: a click elsewhere on the trigger still reaches document.
      fireEvent.click(trigger);
      expect(documentClick).toHaveBeenCalledTimes(1);
    } finally {
      document.removeEventListener("click", documentClick);
    }
  });
});

describe("Navbar mobile menu", () => {
  it("toggles the mobile menu and its aria-label", async () => {
    await renderNavbar();

    const toggle = screen.getByRole("button", { name: "Open menu" });
    // The mobile-only "Join In" entry is not rendered while closed.
    expect(screen.getAllByText("Join In")).toHaveLength(1); // dropdown copy only

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Close menu");
    expect(screen.getAllByText("Join In").length).toBeGreaterThan(1);

    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-label")).toBe("Open menu");
    expect(screen.getAllByText("Join In")).toHaveLength(1);
  });
});
