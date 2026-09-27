// @vitest-environment jsdom
//
// Covers src/components/docs/EditPageLink.tsx (previously 0%):
//  - buildGitHubEditUrl: static fallback, shared-config override, path
//    sanitization, unknown-project null
//  - EditPageLink rendering: full and icon variants, and the
//    isValidGitHubEditUrl XSS guard (protocol / hostname / path checks)
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { SharedConfig } from "@/hooks/useSharedConfig";

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

import EditPageLink, {
  buildGitHubEditUrl,
} from "@/components/docs/EditPageLink";
import type { ProjectId } from "@/config/versions";

function configWithEditBase(editBaseUrls: Record<string, string>) {
  return { config: { editBaseUrls } as unknown as SharedConfig };
}

beforeEach(() => {
  cleanup();
  useSharedConfigMock.mockReset();
  useSharedConfigMock.mockReturnValue({ config: null });
});

describe("buildGitHubEditUrl", () => {
  it("falls back to the static edit base URL per project", () => {
    expect(buildGitHubEditUrl("guide/intro.md", "hive")).toBe(
      "https://github.com/hivecommons/hive/edit/v5/src/docs/guide/intro.md"
    );
    expect(buildGitHubEditUrl("README.md", "pluk")).toBe(
      "https://github.com/hivecommons/pluk/edit/main/README.md"
    );
  });

  it("prefers the shared-config override over the static base", () => {
    const url = buildGitHubEditUrl("docs/a.md", "pluk", {
      pluk: "https://github.com/hivecommons/pluk/edit/release-branch/docs",
    });
    expect(url).toBe(
      "https://github.com/hivecommons/pluk/edit/release-branch/docs/docs/a.md"
    );
  });

  it("still uses the static base when the override map lacks the project", () => {
    const url = buildGitHubEditUrl("a.md", "dibs", {
      pluk: "https://github.com/hivecommons/pluk/edit/release-branch/docs",
    });
    expect(url).toBe("https://github.com/hivecommons/dibs/edit/main/a.md");
  });

  it("returns null when no base URL exists for the project", () => {
    expect(buildGitHubEditUrl("a.md", "nope" as ProjectId)).toBeNull();
  });

  it("strips .. sequences and leading slashes from the file path", () => {
    expect(buildGitHubEditUrl("../../etc/passwd", "hotshot")).toBe(
      "https://github.com/hivecommons/hotshot/edit/main/etc/passwd"
    );
    expect(buildGitHubEditUrl("///docs/x.md", "hotshot")).toBe(
      "https://github.com/hivecommons/hotshot/edit/main/docs/x.md"
    );
  });
});

describe("EditPageLink rendering", () => {
  it("renders the full variant with a validated GitHub href", () => {
    render(<EditPageLink filePath="guide/intro.md" projectId="hive" />);
    const link = screen.getByRole("link", {
      name: /edit this page on github/i,
    });
    expect(link).toHaveProperty(
      "href",
      "https://github.com/hivecommons/hive/edit/v5/src/docs/guide/intro.md"
    );
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("renders the icon variant with a title instead of text", () => {
    render(
      <EditPageLink filePath="a.md" projectId="pluk" variant="icon" />
    );
    const link = screen.getByTitle("Edit this page on GitHub");
    expect(link).toHaveProperty(
      "href",
      "https://github.com/hivecommons/pluk/edit/main/a.md"
    );
    expect(link.textContent).toBe("");
  });

  it("uses the shared-config edit base when provided", () => {
    useSharedConfigMock.mockReturnValue(
      configWithEditBase({
        pluk: "https://github.com/hivecommons/pluk/edit/release-branch/docs",
      })
    );
    render(<EditPageLink filePath="guide/intro.md" projectId="pluk" />);
    const link = screen.getByRole("link", {
      name: /edit this page on github/i,
    });
    expect(link).toHaveProperty(
      "href",
      "https://github.com/hivecommons/pluk/edit/release-branch/docs/guide/intro.md"
    );
  });

  it.each([
    ["non-github host", "https://evil.example.com/edit/main"],
    ["plain http", "http://github.com/hivecommons/hive/edit/v5"],
    ["missing /edit/ path", "https://github.com/hivecommons/hive/blob/main"],
    ["javascript scheme", "javascript:alert(1)//edit/"],
  ])("renders nothing for an unsafe base URL (%s)", (_name, base) => {
    useSharedConfigMock.mockReturnValue(configWithEditBase({ hive: base }));
    const { container } = render(
      <EditPageLink filePath="a.md" projectId="hive" />
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when no base URL resolves at all", () => {
    const { container } = render(
      <EditPageLink filePath="a.md" projectId={"nope" as ProjectId} />
    );
    expect(container.innerHTML).toBe("");
  });
});
