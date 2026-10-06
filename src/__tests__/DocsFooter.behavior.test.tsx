// @vitest-environment jsdom
//
// Runtime behavior coverage for src/components/docs/DocsFooter.tsx
// (previously 0% — DocsFooter.copy.test.ts only scans the source text):
//  - brand description, the four section headings, and the current-year
//    copyright render after mount
//  - project links point at each project's introduction page; external and
//    social links carry target="_blank" + rel="noopener noreferrer"
//  - newsletter form: empty email is a no-op, a real email triggers the
//    "not available yet" alert and clears the field
//  - dark vs light resolvedTheme picks the matching text classes
//
// KNOWN GAP (not asserted here): the back-to-top wiring effect runs with []
// deps against the pre-mount fallback render, which does not contain
// #back-to-top, so its scroll/click listeners are never attached once the
// real footer renders. Fixing that is a production change tracked in the
// coverage-gap issue; this file only pins that the button renders.
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

let resolvedTheme = "dark";

vi.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme, setTheme: vi.fn() }),
}));

vi.mock("@/components/index", () => ({
  GridLines: () => <div data-testid="grid-lines" />,
  StarField: () => <div data-testid="star-field" />,
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

import DocsFooter from "@/components/docs/DocsFooter";

let alertSpy: ReturnType<typeof vi.spyOn>;

function linkByHref(href: string): HTMLElement[] {
  return screen
    .getAllByRole("link")
    .filter(a => a.getAttribute("href") === href);
}

beforeEach(() => {
  resolvedTheme = "dark";
  alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("DocsFooter content", () => {
  it("renders the brand copy, section headings, and year-substituted copyright", () => {
    render(<DocsFooter />);

    expect(
      screen.getByText(/Hive Commons is an open source home for projects/)
    ).toBeTruthy();
    for (const heading of [
      "Projects",
      "Get started",
      "Community",
      "Resources",
    ]) {
      expect(screen.getByRole("heading", { name: heading })).toBeTruthy();
    }
    expect(
      screen.getByText(new RegExp(`© ${new Date().getFullYear()} Hive Commons`))
    ).toBeTruthy();
  });

  it("links every project to its introduction page", () => {
    render(<DocsFooter />);
    for (const project of [
      "hive",
      "hotshot",
      "pluk",
      "rationguard",
      "promptargs",
      "spektacular",
      "dibs",
    ]) {
      expect(linkByHref(`/docs/${project}/overview/introduction`)).toHaveLength(
        1
      );
    }
  });

  it("marks external and social links target=_blank rel=noopener noreferrer", () => {
    render(<DocsFooter />);
    for (const href of [
      "https://hivecommons.dev/discord",
      "https://hivecommons.dev/tv",
      "https://hivecommons.dev/join",
      "https://hive.hivecommons.dev",
    ]) {
      const links = linkByHref(href);
      expect(links.length).toBeGreaterThan(0);
      for (const a of links) {
        expect(a.getAttribute("target")).toBe("_blank");
        expect(a.getAttribute("rel")).toBe("noopener noreferrer");
      }
    }
    expect(
      screen
        .getByRole("link", { name: "Hive Commons on GitHub" })
        .getAttribute("href")
    ).toBe("https://github.com/hivecommons");
  });

  it("renders the policy links in the bottom bar", () => {
    render(<DocsFooter />);
    expect(linkByHref("/docs/contributing/license")).toHaveLength(1);
    expect(linkByHref("/docs/contributing/security/policy")).toHaveLength(1);
    expect(linkByHref("/docs/contributing/security/contacts")).toHaveLength(1);
  });
});

describe("DocsFooter newsletter form", () => {
  it("ignores an empty email", () => {
    // type="email" inputs sanitize whitespace away, so the trimmed-empty
    // guard is exercised with the field left empty.
    render(<DocsFooter />);
    const input = screen.getByPlaceholderText("Email") as HTMLInputElement;
    fireEvent.submit(input.closest("form")!);
    expect(alertSpy).not.toHaveBeenCalled();
  });

  it("alerts that subscriptions are unavailable and clears a real email", () => {
    render(<DocsFooter />);
    const input = screen.getByPlaceholderText("Email") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "bee@example.com" } });
    fireEvent.submit(input.closest("form")!);
    expect(alertSpy).toHaveBeenCalledWith(
      "Subscriptions are not available yet. Please try again later."
    );
    expect(input.value).toBe("");
  });
});

describe("DocsFooter back-to-top button", () => {
  it("renders the labelled back-to-top button", () => {
    render(<DocsFooter />);
    const button = document.getElementById("back-to-top");
    expect(button).toBeTruthy();
    expect(button!.getAttribute("aria-label")).toBe("Back to top");
  });
});

describe("DocsFooter theming", () => {
  it("uses the dark text classes when resolvedTheme is dark", () => {
    render(<DocsFooter />);
    const copyright = screen.getByText(/© \d{4} Hive Commons/);
    expect(copyright.className).toContain("text-ink-3");
  });

  it("uses the light text classes when resolvedTheme is light", () => {
    resolvedTheme = "light";
    render(<DocsFooter />);
    const copyright = screen.getByText(/© \d{4} Hive Commons/);
    expect(copyright.className).toContain("text-ink-2");
  });
});
