import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Drives the CLI entry of scripts/run-sync-step.ts IN PROCESS, the way
// `npm run prebuild` invokes it (`tsx scripts/run-sync-step.ts <script>`).
// The module calls process.exit() only when process.argv[1] ends with
// "run-sync-step.ts", so each case:
//   1. sets process.argv to the script path + optional argument,
//   2. stubs process.exit (throws ExitSignal) and console.{warn,error},
//   3. mocks node:child_process so no real `tsx` child is spawned,
//   4. vi.resetModules() + dynamic import() to re-run the top-level code.
// Running in process (same approach as check-internal-links.main.test.ts)
// lets v8 attribute coverage to the entry block itself.

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn<(...args: unknown[]) => { status: number | null }>(),
}));

vi.mock("node:child_process", () => ({ spawnSync: spawnMock }));

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  ".."
);
const scriptPath = path.join(repoRoot, "scripts", "run-sync-step.ts");

class ExitSignal extends Error {
  constructor(public code: number | string | null | undefined) {
    super(`process.exit(${code})`);
  }
}

let origArgv: string[];
let origOptional: string | undefined;
let exitSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;
let errSpy: ReturnType<typeof vi.spyOn>;

async function runEntry(argv: string[]): Promise<number | null> {
  process.argv = [process.execPath, ...argv];
  vi.resetModules();
  try {
    await import("./run-sync-step");
  } catch (e) {
    if (e instanceof ExitSignal) return e.code as number;
    throw e;
  }
  return null;
}

beforeEach(() => {
  origArgv = process.argv;
  origOptional = process.env.DOCS_SYNC_OPTIONAL;
  delete process.env.DOCS_SYNC_OPTIONAL;
  spawnMock.mockReset();
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((code?: number) => {
    throw new ExitSignal(code);
  }) as never);
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  process.argv = origArgv;
  if (origOptional === undefined) delete process.env.DOCS_SYNC_OPTIONAL;
  else process.env.DOCS_SYNC_OPTIONAL = origOptional;
  exitSpy.mockRestore();
  warnSpy.mockRestore();
  errSpy.mockRestore();
});

describe("run-sync-step CLI entry", () => {
  it("does nothing when imported as a library (argv[1] is another file)", async () => {
    const code = await runEntry([
      path.join(repoRoot, "scripts", "something-else.ts"),
      "scripts/sync-hive-docs.ts",
    ]);
    expect(code).toBeNull();
    expect(spawnMock).not.toHaveBeenCalled();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it("exits 2 with a usage message when no script is given", async () => {
    const code = await runEntry([scriptPath]);
    expect(code).toBe(2);
    expect(spawnMock).not.toHaveBeenCalled();
    expect(errSpy).toHaveBeenCalledWith(
      "usage: tsx scripts/run-sync-step.ts <script>"
    );
  });

  it("spawns `tsx <script>` with inherited stdio and exits 0 on success", async () => {
    spawnMock.mockReturnValue({ status: 0 });
    const code = await runEntry([scriptPath, "scripts/sync-hive-docs.ts"]);
    expect(code).toBe(0);
    expect(spawnMock).toHaveBeenCalledTimes(1);
    const [cmd, args, opts] = spawnMock.mock.calls[0] as [
      string,
      string[],
      { stdio: string; env: unknown; shell: boolean },
    ];
    expect(cmd).toBe("tsx");
    expect(args).toEqual(["scripts/sync-hive-docs.ts"]);
    expect(opts.stdio).toBe("inherit");
    expect(opts.env).toBe(process.env);
    expect(opts.shell).toBe(process.platform === "win32");
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("propagates the child's non-zero exit code so prebuild fails", async () => {
    spawnMock.mockReturnValue({ status: 3 });
    const code = await runEntry([scriptPath, "scripts/sync-sibling-docs.ts"]);
    expect(code).toBe(3);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("exits 1 when the child was killed by a signal (status null)", async () => {
    spawnMock.mockReturnValue({ status: null });
    const code = await runEntry([scriptPath, "scripts/sync-sibling-docs.ts"]);
    expect(code).toBe(1);
  });

  it("exits 0 with a warning on failure when DOCS_SYNC_OPTIONAL=1", async () => {
    process.env.DOCS_SYNC_OPTIONAL = "1";
    spawnMock.mockReturnValue({ status: 1 });
    const code = await runEntry([
      scriptPath,
      "scripts/update-meeting-recordings.ts",
    ]);
    expect(code).toBe(0);
    expect(warnSpy).toHaveBeenCalledWith(
      "scripts/update-meeting-recordings.ts failed (exit 1); DOCS_SYNC_OPTIONAL=1 so using committed content"
    );
  });

  it('DOCS_SYNC_OPTIONAL must be exactly "1" to tolerate failure', async () => {
    process.env.DOCS_SYNC_OPTIONAL = "true";
    spawnMock.mockReturnValue({ status: 1 });
    const code = await runEntry([scriptPath, "scripts/sync-hive-docs.ts"]);
    expect(code).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
  });
});
