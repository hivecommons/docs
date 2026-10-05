import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PROJECTS } from "../src/config/versions";

/**
 * generate-shared-config.ts runs at import time and resolves its input and
 * output paths from its own file location, so generate-shared-config.test.ts
 * copies it into a temp repo and spawns it via tsx — correct, but invisible
 * to v8 coverage. Here the script is imported in-process with the default
 * `node:fs` export mocked: reads of shared.json are served from a fixture and
 * the write is captured, so the repo's real public/config/shared.json is
 * never touched while the script body is attributed in the coverage report.
 */

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const sharedJsonPath = path.join(repoRoot, "public", "config", "shared.json");

const fsState = vi.hoisted(() => ({
  existing: null as string | null,
  written: [] as Array<{ file: string; data: string }>,
}));

vi.mock("node:fs", async importOriginal => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mocked = {
    ...actual,
    existsSync: (file: import("node:fs").PathLike) =>
      String(file) === sharedJsonPath
        ? fsState.existing !== null
        : actual.existsSync(file),
    readFileSync: ((
      file: import("node:fs").PathOrFileDescriptor,
      ...rest: unknown[]
    ) =>
      String(file) === sharedJsonPath && fsState.existing !== null
        ? fsState.existing
        : (actual.readFileSync as (...a: unknown[]) => unknown)(
            file,
            ...rest
          )) as typeof actual.readFileSync,
    writeFileSync: ((
      file: import("node:fs").PathOrFileDescriptor,
      data: string | NodeJS.ArrayBufferView
    ) => {
      fsState.written.push({ file: String(file), data: String(data) });
    }) as typeof actual.writeFileSync,
  };
  return { ...mocked, default: mocked };
});

async function runScript() {
  vi.resetModules();
  await import("./generate-shared-config");
  await vi.waitFor(() => {
    expect(fsState.written.length).toBeGreaterThan(0);
  });
  const [write] = fsState.written;
  return { write, config: JSON.parse(write.data) };
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fsState.existing = null;
  fsState.written = [];
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("generate-shared-config (in-process)", () => {
  it("writes shared.json next to public/config with versions derived from versions.ts", async () => {
    const { write, config } = await runScript();

    expect(write.file).toBe(sharedJsonPath);
    expect(write.data.endsWith("\n")).toBe(true);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        `Generated ${path.join("public", "config", "shared.json")} from versions.ts`
      )
    );

    expect(Object.keys(config.versions).sort()).toEqual(
      Object.keys(PROJECTS).sort()
    );
    for (const [id, project] of Object.entries(PROJECTS)) {
      expect(config.projects[id]).toEqual({
        name: project.name,
        basePath: project.basePath,
        currentVersion: project.currentVersion,
      });
      for (const [key, v] of Object.entries(project.versions)) {
        const entry = config.versions[id][key];
        expect(entry).toMatchObject({
          label: v.label,
          branch: v.branch,
          isDefault: v.isDefault,
        });
        // Optional fields are only emitted when set, so the JSON stays minimal.
        if (v.externalUrl) expect(entry.externalUrl).toBe(v.externalUrl);
        else expect(entry).not.toHaveProperty("externalUrl");
        if (v.isDev) expect(entry.isDev).toBe(true);
        else expect(entry).not.toHaveProperty("isDev");
      }
    }
    expect(Number.isNaN(Date.parse(config.updatedAt))).toBe(false);
  });

  it("starts from empty hand-maintained fields when no shared.json exists", async () => {
    fsState.existing = null;
    const { config } = await runScript();

    expect(config.surveyUrl).toBeUndefined();
    expect(config.relatedProjects).toEqual([]);
    expect(config.editBaseUrls).toEqual({});
  });

  it("preserves surveyUrl, relatedProjects and editBaseUrls from the existing file", async () => {
    fsState.existing = JSON.stringify({
      surveyUrl: "https://survey.example.test",
      relatedProjects: [
        { name: "Sibling", url: "https://sibling.example.test" },
      ],
      editBaseUrls: { custom: "https://github.com/example/custom/edit/main" },
      versions: { stale: {} },
      projects: { stale: {} },
    });

    const { config } = await runScript();

    expect(config.surveyUrl).toBe("https://survey.example.test");
    expect(config.relatedProjects).toEqual([
      { name: "Sibling", url: "https://sibling.example.test" },
    ]);
    expect(config.editBaseUrls).toEqual({
      custom: "https://github.com/example/custom/edit/main",
    });
    // Version/project maps always come from versions.ts, never the old file.
    expect(config.versions).not.toHaveProperty("stale");
    expect(config.projects).not.toHaveProperty("stale");
  });

  it("tolerates an existing file without editBaseUrls", async () => {
    fsState.existing = JSON.stringify({ surveyUrl: "https://s.example.test" });

    const { config } = await runScript();

    expect(config.editBaseUrls).toEqual({});
    expect(config.relatedProjects).toEqual([]);
  });
});
