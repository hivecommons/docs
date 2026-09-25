import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * generate-shared-config.ts is the prebuild bridge that regenerates
 * public/config/shared.json from src/config/versions.ts. It resolves every
 * path relative to its own file location, so these tests copy the script
 * into a throwaway repo-shaped temp directory with a fixture versions.ts and
 * run it there via tsx — the real repo's shared.json is never touched.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const scriptSource = path.join(repoRoot, "scripts", "generate-shared-config.ts");
const tsxBin = path.join(repoRoot, "node_modules", ".bin", "tsx");

const FIXTURE_VERSIONS = `
export const PROJECTS = {
  alpha: {
    name: "Alpha",
    basePath: "/docs/alpha",
    currentVersion: "v5",
    versions: {
      v5: { label: "v5 (stable)", branch: "v5", isDefault: true },
      v6: { label: "v6 (dev)", branch: "v6", isDefault: false, isDev: true },
      v4: {
        label: "v4 (archived)",
        branch: "v4",
        isDefault: false,
        externalUrl: "https://v4.example.test",
      },
    },
  },
  beta: {
    name: "Beta",
    basePath: "/docs/beta",
    currentVersion: "main",
    versions: {
      main: { label: "main", branch: "main", isDefault: true },
    },
  },
};
`;

let tmpRoot: string;

function writeFixtureRepo(): { scriptPath: string; sharedJsonPath: string } {
  const scriptsDir = path.join(tmpRoot, "scripts");
  const configDir = path.join(tmpRoot, "src", "config");
  const publicConfigDir = path.join(tmpRoot, "public", "config");
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(configDir, { recursive: true });
  fs.mkdirSync(publicConfigDir, { recursive: true });
  const scriptPath = path.join(scriptsDir, "generate-shared-config.ts");
  fs.copyFileSync(scriptSource, scriptPath);
  fs.writeFileSync(path.join(configDir, "versions.ts"), FIXTURE_VERSIONS);
  return { scriptPath, sharedJsonPath: path.join(publicConfigDir, "shared.json") };
}

function runScript(scriptPath: string) {
  const result = spawnSync(tsxBin, [scriptPath], {
    cwd: tmpRoot,
    encoding: "utf8",
    timeout: 60_000,
  });
  if (result.status !== 0) {
    throw new Error(
      `generate-shared-config failed (status ${result.status}):\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result;
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gen-shared-config-"));
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe("generate-shared-config", () => {
  it("generates shared.json from versions.ts when none exists", () => {
    const { scriptPath, sharedJsonPath } = writeFixtureRepo();
    runScript(scriptPath);

    const raw = fs.readFileSync(sharedJsonPath, "utf8");
    expect(raw.endsWith("\n")).toBe(true);
    const shared = JSON.parse(raw);

    expect(Object.keys(shared.projects)).toEqual(["alpha", "beta"]);
    expect(shared.projects.alpha).toEqual({
      name: "Alpha",
      basePath: "/docs/alpha",
      currentVersion: "v5",
    });
    expect(shared.versions.alpha.v5).toEqual({
      label: "v5 (stable)",
      branch: "v5",
      isDefault: true,
    });
    // Defaults for hand-maintained fields when nothing pre-exists.
    expect(shared.relatedProjects).toEqual([]);
    expect(shared.editBaseUrls).toEqual({});
    expect(shared.surveyUrl).toBeUndefined();
  });

  it("emits externalUrl and isDev only for versions that set them", () => {
    const { scriptPath, sharedJsonPath } = writeFixtureRepo();
    runScript(scriptPath);
    const shared = JSON.parse(fs.readFileSync(sharedJsonPath, "utf8"));

    expect(shared.versions.alpha.v6.isDev).toBe(true);
    expect(shared.versions.alpha.v4.externalUrl).toBe("https://v4.example.test");
    // The stable entry must not carry the optional keys at all.
    expect("isDev" in shared.versions.alpha.v5).toBe(false);
    expect("externalUrl" in shared.versions.alpha.v5).toBe(false);
    expect("externalUrl" in shared.versions.beta.main).toBe(false);
  });

  it("preserves hand-maintained fields from an existing shared.json", () => {
    const { scriptPath, sharedJsonPath } = writeFixtureRepo();
    fs.writeFileSync(
      sharedJsonPath,
      JSON.stringify({
        surveyUrl: "https://survey.example.test/q1",
        relatedProjects: [{ name: "Spektacular", url: "https://spektacular.dev" }],
        editBaseUrls: { docs: "https://example.test/edit/main/docs" },
        // Stale generated data that must be replaced, not preserved.
        versions: { stale: {} },
        projects: { stale: {} },
      }),
    );
    runScript(scriptPath);
    const shared = JSON.parse(fs.readFileSync(sharedJsonPath, "utf8"));

    expect(shared.surveyUrl).toBe("https://survey.example.test/q1");
    expect(shared.relatedProjects).toEqual([
      { name: "Spektacular", url: "https://spektacular.dev" },
    ]);
    expect(shared.editBaseUrls).toEqual({
      docs: "https://example.test/edit/main/docs",
    });
    // Generated sections are rebuilt from versions.ts.
    expect(shared.versions.stale).toBeUndefined();
    expect(shared.projects.stale).toBeUndefined();
    expect(Object.keys(shared.projects)).toEqual(["alpha", "beta"]);
  });

  it("stamps updatedAt with a parseable ISO timestamp", () => {
    const { scriptPath, sharedJsonPath } = writeFixtureRepo();
    const before = Date.now();
    runScript(scriptPath);
    const shared = JSON.parse(fs.readFileSync(sharedJsonPath, "utf8"));
    const stamp = Date.parse(shared.updatedAt);
    expect(Number.isNaN(stamp)).toBe(false);
    expect(stamp).toBeGreaterThanOrEqual(before - 1000);
    expect(stamp).toBeLessThanOrEqual(Date.now() + 1000);
  });
});
