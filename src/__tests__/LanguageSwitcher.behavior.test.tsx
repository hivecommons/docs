// @vitest-environment jsdom
//
// Covers src/components/LanguageSwitcher.tsx (previously 0%):
//  - dropdown variant: label rendering, showLabel prop, aria state
//  - opening the menu lists every locale with aria-selected on the current one
//  - selecting another locale navigates via router.replace with the pathname
//    and new locale after the transition delay, then closes the dropdown
//  - selecting the current locale closes the menu without navigating
//  - Escape closes the menu and refocuses the trigger button
//  - mousedown outside the menu closes it
//  - minimal variant: uppercase locale code trigger and option list
//  - LanguageSwitcherMinimal / LanguageSwitcherFull convenience exports
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";

import { locales, localeNames } from "@/i18n/settings";

const replaceMock = vi.fn();
let currentLocale = "en";
let currentPathname = "/docs/hive/overview";

vi.mock("next-intl", () => ({
  useLocale: () => currentLocale,
  useTranslations: () => (key: string) =>
    key === "selectLanguage" ? "Select Language" : key,
}));

vi.mock("@/i18n/navigation", () => ({
  usePathname: () => currentPathname,
  useRouter: () => ({ replace: replaceMock }),
}));

import LanguageSwitcher, {
  LanguageSwitcherFull,
  LanguageSwitcherMinimal,
} from "@/components/LanguageSwitcher";

beforeEach(() => {
  vi.useFakeTimers();
  replaceMock.mockReset();
  currentLocale = "en";
  currentPathname = "/docs/hive/overview";
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

function trigger(): HTMLButtonElement {
  return screen.getByRole("button", {
    name: /Current language: English/,
  }) as HTMLButtonElement;
}

describe("LanguageSwitcher dropdown variant", () => {
  it("renders the current language label and closed aria state", () => {
    render(<LanguageSwitcher />);
    const btn = trigger();
    expect(btn.textContent).toContain("English");
    expect(btn.getAttribute("aria-expanded")).toBe("false");
    expect(btn.getAttribute("aria-haspopup")).toBe("listbox");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("hides the label when showLabel is false", () => {
    render(<LanguageSwitcher showLabel={false} />);
    expect(trigger().textContent).not.toContain("English");
  });

  it("applies the className prop to the wrapper", () => {
    const { container } = render(<LanguageSwitcher className="navbar-slot" />);
    expect(
      (container.firstChild as HTMLElement).className.includes("navbar-slot")
    ).toBe(true);
  });

  it("opens a listbox with every locale and marks the current one selected", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());

    expect(trigger().getAttribute("aria-expanded")).toBe("true");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(locales.length);

    for (const loc of locales) {
      // "English" also appears in the trigger label, so allow multiples.
      expect(screen.getAllByText(localeNames[loc]).length).toBeGreaterThan(0);
    }

    const selected = options.filter(
      o => o.getAttribute("aria-selected") === "true"
    );
    expect(selected).toHaveLength(1);
    expect(selected[0].textContent).toContain("English");

    expect(screen.getByText("Select Language")).toBeTruthy();
  });

  it("navigates to the chosen locale after the transition delay and closes", async () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());

    fireEvent.click(screen.getByText(localeNames.ja));

    // While the 150ms transition is pending: spinner shows, no navigation yet.
    expect(screen.getByText("Switching...")).toBeTruthy();
    expect(replaceMock).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(replaceMock).toHaveBeenCalledWith("/docs/hive/overview", {
      locale: "ja",
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes without navigating when the current locale is re-selected", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());

    const enOption = screen
      .getAllByRole("option")
      .find(o => o.getAttribute("aria-selected") === "true")!;
    fireEvent.click(enOption);

    expect(replaceMock).not.toHaveBeenCalled();
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("closes on Escape and refocuses the trigger", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("listbox")).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it("ignores non-Escape keys while open", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());

    fireEvent.keyDown(document, { key: "Enter" });

    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("closes on mousedown outside the dropdown", () => {
    render(
      <div>
        <span data-testid="outside">outside</span>
        <LanguageSwitcher />
      </div>
    );
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeTruthy();

    fireEvent.mouseDown(screen.getByTestId("outside"));

    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("stays open on mousedown inside the dropdown", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());

    fireEvent.mouseDown(screen.getByText(localeNames.de));

    expect(screen.getByRole("listbox")).toBeTruthy();
  });

  it("toggles closed when the trigger is clicked again", () => {
    render(<LanguageSwitcher />);
    fireEvent.click(trigger());
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.click(trigger());
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("LanguageSwitcher minimal variant", () => {
  it("renders the uppercase locale code as the trigger", () => {
    currentLocale = "pt";
    render(<LanguageSwitcher variant="minimal" />);
    const btn = screen.getByRole("button", {
      name: /Current language: Português/,
    });
    expect(btn.textContent).toContain("PT");
    expect(screen.queryByRole("listbox")).toBeNull();
  });

  it("opens the option list and navigates on selection", async () => {
    render(<LanguageSwitcher variant="minimal" />);
    fireEvent.click(trigger());

    expect(screen.getAllByRole("option")).toHaveLength(locales.length);

    fireEvent.click(screen.getByText(localeNames["zh-TW"]));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(replaceMock).toHaveBeenCalledWith("/docs/hive/overview", {
      locale: "zh-TW",
    });
    expect(screen.queryByRole("listbox")).toBeNull();
  });
});

describe("convenience exports", () => {
  it("LanguageSwitcherMinimal renders the minimal variant", () => {
    currentLocale = "fr";
    render(<LanguageSwitcherMinimal />);
    expect(
      screen.getByRole("button", { name: /Current language: Français/ })
        .textContent
    ).toContain("FR");
  });

  it("LanguageSwitcherFull renders the dropdown variant with the label", () => {
    render(<LanguageSwitcherFull />);
    expect(trigger().textContent).toContain("English");
  });
});
