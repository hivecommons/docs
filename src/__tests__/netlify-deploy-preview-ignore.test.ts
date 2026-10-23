// Guards the `[context.deploy-preview] ignore` rule in netlify.toml (#419).
// The rule is a shell `case` statement embedded in a TOML string, and Netlify
// is the only thing that ever runs it, after merge. Its failure mode is
// silent: Netlify skips the build only on exit 0, so a quoting slip or a
// dropped alternative does not break anything visible — it just lets the bot
// previews it was meant to suppress start draining build minutes again.
// Running the exact string under `sh` here is the earliest point that can
// be caught.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..");
const NETLIFY_TOML = readFileSync(join(REPO_ROOT, "netlify.toml"), "utf8");

// netlify.toml only uses flat `key = "value"` tables. The ignore value is a
// TOML basic string, so `\"` and `\\` escapes have to be undone before the
// command is handed to a shell exactly as Netlify would.
export function readDeployPreviewIgnore(toml: string): string | undefined {
  const lines = toml.split("\n").map(l => l.trim());
  const start = lines.indexOf("[context.deploy-preview]");
  if (start === -1) return undefined;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("[")) break;
    const m = line.match(/^ignore\s*=\s*"(.*)"\s*$/);
    if (m) return m[1].replace(/\\(["\\])/g, "$1");
  }
  return undefined;
}

// Mirrors what Netlify does with the ignore command: run it through `sh`
// with the deploy context's environment. HEAD is the PR head branch on a
// deploy preview; BRANCH is always set.
function runIgnore(
  command: string,
  env: { HEAD?: string; BRANCH?: string }
): number {
  const res = spawnSync("sh", ["-c", command], {
    env: { PATH: process.env.PATH ?? "/usr/bin:/bin", ...env },
    encoding: "utf8",
  });
  expect(res.error).toBeUndefined();
  expect(res.stderr).toBe("");
  return res.status ?? -1;
}

const SKIP = 0; // Netlify: exit 0 → skip the build
const BUILD = 1; // Netlify: any other exit → build

const ignore = readDeployPreviewIgnore(NETLIFY_TOML);

describe("netlify.toml [context.deploy-preview] ignore", () => {
  it("is present and is the bot-branch case statement", () => {
    expect(ignore).toBeDefined();
    expect(ignore).toMatch(/^case "\$\{HEAD:-\$BRANCH\}" in .* esac$/);
  });

  it("is valid sh (a quoting slip would fail open as exit 2 = build)", () => {
    const res = spawnSync("sh", ["-n", "-c", ignore!], { encoding: "utf8" });
    expect(res.stderr).toBe("");
    expect(res.status).toBe(0);
  });

  it.each([
    "arch/docs",
    "scanner/fix-419",
    "quality/test-netlify-ignore",
    "hive/forward-merge",
    "dependabot/npm_and_yarn/next-16.4.1",
  ])("skips the preview for bot branch %s", head => {
    expect(runIgnore(ignore!, { HEAD: head, BRANCH: head })).toBe(SKIP);
  });

  it.each([
    "main",
    "feature/new-landing",
    "fix/typo",
    "docs/v1.2",
    // A human branch that merely contains a bot prefix must still build:
    // the patterns are anchored to the start of the branch name.
    "feat/scanner/dashboard",
    "myquality/notes",
  ])("builds the preview for non-bot branch %s", head => {
    expect(runIgnore(ignore!, { HEAD: head, BRANCH: head })).toBe(BUILD);
  });

  it("falls back to BRANCH when HEAD is unset", () => {
    expect(runIgnore(ignore!, { BRANCH: "scanner/fix-1" })).toBe(SKIP);
    expect(runIgnore(ignore!, { BRANCH: "main" })).toBe(BUILD);
  });

  it("prefers HEAD over BRANCH when both are set", () => {
    // On a deploy preview HEAD is the PR head; BRANCH may name the target.
    expect(runIgnore(ignore!, { HEAD: "scanner/fix-1", BRANCH: "main" })).toBe(
      SKIP
    );
    expect(runIgnore(ignore!, { HEAD: "main", BRANCH: "scanner/fix-1" })).toBe(
      BUILD
    );
  });

  it("builds when neither variable is set rather than silently skipping", () => {
    expect(runIgnore(ignore!, {})).toBe(BUILD);
  });
});
