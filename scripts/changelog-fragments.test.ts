// Guards changelog.d/ fragments so a malformed one fails the PR that adds it.
// Fragments are rolled up into Keep-a-Changelog headings by their filename
// prefix, and each file is expected to BE the bullet entry; a fragment with an
// unknown prefix, an empty body, or a prose (non-bullet) body would be dropped
// or mis-sectioned at roll-up time. See changelog.d/README.md.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const FRAGMENT_DIR = join(__dirname, "..", "changelog.d");
const EXEMPT = new Set(["README.md", ".gitkeep"]);

export const CATEGORIES = [
  "added",
  "changed",
  "deprecated",
  "removed",
  "fixed",
  "security",
] as const;

export const FRAGMENT_NAME = new RegExp(
  `^(${CATEGORIES.join("|")})-[a-z0-9][a-z0-9-]*\\.md$`
);

export function fragmentNameErrors(name: string): string[] {
  if (EXEMPT.has(name)) return [];
  if (!FRAGMENT_NAME.test(name)) {
    return [
      `${name}: must be named <category>-<slug>.md with category one of ${CATEGORIES.join("/")}`,
    ];
  }
  return [];
}

export function fragmentBodyErrors(name: string, body: string): string[] {
  if (EXEMPT.has(name)) return [];
  const lines = body.split("\n").filter(l => l.trim() !== "");
  if (lines.length === 0) return [`${name}: fragment is empty`];
  const errors: string[] = [];
  for (const line of lines) {
    if (!/^(- | {2})/.test(line)) {
      errors.push(
        `${name}: every line must be a "- " bullet or a two-space continuation: ${JSON.stringify(line)}`
      );
      break;
    }
  }
  if (!body.endsWith("\n")) errors.push(`${name}: missing trailing newline`);
  return errors;
}

function fragmentEntries(): string[] {
  return readdirSync(FRAGMENT_DIR).filter(
    n => !statSync(join(FRAGMENT_DIR, n)).isDirectory()
  );
}

describe("changelog.d fragments", () => {
  it("contain no directories", () => {
    const dirs = readdirSync(FRAGMENT_DIR).filter(n =>
      statSync(join(FRAGMENT_DIR, n)).isDirectory()
    );
    expect(dirs).toEqual([]);
  });

  it("are named <category>-<slug>.md", () => {
    const errors = fragmentEntries().flatMap(fragmentNameErrors);
    expect(errors).toEqual([]);
  });

  it("are non-empty markdown bullet lists ending in a newline", () => {
    const errors = fragmentEntries().flatMap(name =>
      fragmentBodyErrors(name, readFileSync(join(FRAGMENT_DIR, name), "utf8"))
    );
    expect(errors).toEqual([]);
  });
});

describe("fragmentNameErrors", () => {
  it("accepts valid names and exempt files", () => {
    expect(fragmentNameErrors("fixed-147.md")).toEqual([]);
    expect(fragmentNameErrors("security-sharp-0-35-5.md")).toEqual([]);
    expect(fragmentNameErrors("README.md")).toEqual([]);
    expect(fragmentNameErrors(".gitkeep")).toEqual([]);
  });

  it("rejects unknown categories and bad slugs", () => {
    for (const bad of [
      "feature-foo.md",
      "fixed-Foo.md",
      "fixed-.md",
      "fixed-foo.txt",
      "fixed.md",
      "fixed-_foo.md",
    ]) {
      expect(fragmentNameErrors(bad)).toHaveLength(1);
    }
  });
});

describe("fragmentBodyErrors", () => {
  it("accepts bullet lists with continuations", () => {
    expect(fragmentBodyErrors("fixed-a.md", "- One line (#1).\n")).toEqual([]);
    expect(
      fragmentBodyErrors("fixed-a.md", "- First.\n  continued.\n\n- Second.\n")
    ).toEqual([]);
    expect(fragmentBodyErrors("README.md", "anything goes\n")).toEqual([]);
  });

  it("rejects empty, prose and unterminated fragments", () => {
    expect(fragmentBodyErrors("fixed-a.md", "")).toEqual([
      "fixed-a.md: fragment is empty",
    ]);
    expect(fragmentBodyErrors("fixed-a.md", "\n\n")).toEqual([
      "fixed-a.md: fragment is empty",
    ]);
    expect(fragmentBodyErrors("fixed-a.md", "Fixed a thing.\n")).toHaveLength(
      1
    );
    expect(fragmentBodyErrors("fixed-a.md", "- No newline")).toEqual([
      "fixed-a.md: missing trailing newline",
    ]);
  });
});
