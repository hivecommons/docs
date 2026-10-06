/**
 * Runs one prebuild sync step (a tsx script) and propagates its exit code.
 * Failures fail the build unless DOCS_SYNC_OPTIONAL=1 is set, in which case the
 * committed content is kept and a warning is printed (local/offline use only).
 */
import { spawnSync } from "node:child_process";

// Plain record rather than NodeJS.ProcessEnv: Next.js augments ProcessEnv with
// a required NODE_ENV, which makes object literals in tests unassignable.
export type SyncEnv = Record<string, string | undefined>;

export function isSyncOptional(env: SyncEnv = process.env): boolean {
  return env.DOCS_SYNC_OPTIONAL === "1";
}

export function runSyncStep(
  script: string,
  env: SyncEnv = process.env,
  run: typeof spawnSync = spawnSync
): number {
  const result = run("tsx", [script], {
    stdio: "inherit",
    env: env as NodeJS.ProcessEnv,
    shell: process.platform === "win32",
  });
  const status = result.status ?? 1;
  if (status !== 0 && isSyncOptional(env)) {
    console.warn(
      `${script} failed (exit ${status}); DOCS_SYNC_OPTIONAL=1 so using committed content`
    );
    return 0;
  }
  return status;
}

if (process.argv[1]?.endsWith("run-sync-step.ts")) {
  const script = process.argv[2];
  if (!script) {
    console.error("usage: tsx scripts/run-sync-step.ts <script>");
    process.exit(2);
  }
  process.exit(runSyncStep(script));
}
