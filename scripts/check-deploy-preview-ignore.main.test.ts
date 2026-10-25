import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Drives the CLI entry of scripts/check-deploy-preview-ignore.ts IN PROCESS,
// the way build.yml invokes it (`npx tsx scripts/check-deploy-preview-ignore.ts`
// with PR_AUTHOR_TYPE / PR_HEAD_REF in the environment). The module sets
// process.exitCode only when process.argv[1] is its own path, so each case:
//   1. sets process.argv and the two PR_* variables,
//   2. mocks node:child_process so the netlify.toml rule is never really run,
//   3. vi.resetModules() + dynamic import() to re-run the top-level code.
// Running in process (same approach as run-sync-step.main.test.ts) lets v8
// attribute coverage to the entry block itself.

const { spawnMock } = vi.hoisted(() => ({
  spawnMock:
    vi.fn<(...args: unknown[]) => { error?: Error; status: number | null }>(),
}));

vi.mock("node:child_process", async importOriginal => ({
  ...(await importOriginal<typeof import("node:child_process")>()),
  spawnSync: spawnMock,
}));

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(
  repoRoot,
  "scripts",
  "check-deploy-preview-ignore.ts"
);

let origArgv: string[];
let origExitCode: typeof process.exitCode;
let origAuthorType: string | undefined;
let origHeadRef: string | undefined;
let logSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

function setEnv(name: string, value: string | undefined): void {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

async function runEntry(
  argv1: string,
  env: { PR_AUTHOR_TYPE?: string; PR_HEAD_REF?: string }
): Promise<typeof process.exitCode> {
  process.argv = [process.execPath, argv1];
  setEnv("PR_AUTHOR_TYPE", env.PR_AUTHOR_TYPE);
  setEnv("PR_HEAD_REF", env.PR_HEAD_REF);
  process.exitCode = undefined;
  vi.resetModules();
  await import("./check-deploy-preview-ignore");
  return process.exitCode;
}

beforeEach(() => {
  origArgv = process.argv;
  origExitCode = process.exitCode;
  origAuthorType = process.env.PR_AUTHOR_TYPE;
  origHeadRef = process.env.PR_HEAD_REF;
  spawnMock.mockReset();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.argv = origArgv;
  process.exitCode = origExitCode;
  setEnv("PR_AUTHOR_TYPE", origAuthorType);
  setEnv("PR_HEAD_REF", origHeadRef);
  logSpy.mockRestore();
  errSpy.mockRestore();
});

describe("check-deploy-preview-ignore CLI entry", () => {
  it("does nothing when imported as a library (argv[1] is another file)", async () => {
    const code = await runEntry(
      path.join(repoRoot, "scripts", "something-else.ts"),
      { PR_AUTHOR_TYPE: "Bot", PR_HEAD_REF: "new-lane/topic" }
    );
    expect(code).toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(errSpy).not.toHaveBeenCalled();
  });

  it("does nothing when argv[1] is absent", async () => {
    process.argv = [process.execPath];
    setEnv("PR_AUTHOR_TYPE", "Bot");
    setEnv("PR_HEAD_REF", "new-lane/topic");
    process.exitCode = undefined;
    vi.resetModules();
    await import("./check-deploy-preview-ignore");
    expect(process.exitCode).toBeUndefined();
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it("reads PR_* from process.env and sets exitCode 0 for a covered Bot head", async () => {
    spawnMock.mockReturnValue({ status: 0 });
    const code = await runEntry(scriptPath, {
      PR_AUTHOR_TYPE: "Bot",
      PR_HEAD_REF: "reviewer/topic",
    });
    expect(code).toBe(0);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [, , opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { env: Record<string, string | undefined> },
    ];
    expect(opts.env.HEAD).toBe("reviewer/topic");
    expect(logSpy).toHaveBeenCalledWith(
      "Bot PR head is covered by the deploy-preview ignore rule."
    );
  });

  it("sets exitCode 1 when the real rule does not skip the Bot head", async () => {
    spawnMock.mockReturnValue({ status: 1 });
    const code = await runEntry(scriptPath, {
      PR_AUTHOR_TYPE: "Bot",
      PR_HEAD_REF: "new-lane/topic",
    });
    expect(code).toBe(1);
    expect(errSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bot PR head is not skipped by netlify.toml")
    );
  });

  it("sets exitCode 1 when a Bot PR has no PR_HEAD_REF", async () => {
    const code = await runEntry(scriptPath, { PR_AUTHOR_TYPE: "Bot" });
    expect(code).toBe(1);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(
      "Missing PR_HEAD_REF for Bot-authored PR."
    );
  });

  it("sets exitCode 0 without running the rule for a human-authored PR", async () => {
    const code = await runEntry(scriptPath, {
      PR_AUTHOR_TYPE: "User",
      PR_HEAD_REF: "new-lane/topic",
    });
    expect(code).toBe(0);
    expect(spawnMock).not.toHaveBeenCalled();
  });
});
