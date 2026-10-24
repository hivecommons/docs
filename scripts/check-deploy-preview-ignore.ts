/** Check the PR head against Netlify's actual rule, without a second lane list. */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// The rule is kept as a single-line TOML basic string. JSON decoding supports
// its quotes/backslashes and rejects malformed escapes instead of failing open.
export function readDeployPreviewIgnore(toml: string): string | undefined {
  const lines = toml.split("\n").map(line => line.trim());
  const start = lines.indexOf("[context.deploy-preview]");
  if (start === -1) return undefined;
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("[")) break;
    const match = line.match(/^ignore\s*=\s*(".*")\s*$/);
    if (match) return JSON.parse(match[1]) as string;
  }
  return undefined;
}

export function main(
  env: Record<string, string | undefined> = process.env
): number {
  if (env.PR_AUTHOR_TYPE !== "Bot") return 0;
  if (!env.PR_HEAD_REF) {
    console.error("Missing PR_HEAD_REF for Bot-authored PR.");
    return 1;
  }

  const command = readDeployPreviewIgnore(readFileSync("netlify.toml", "utf8"));
  if (!command) {
    console.error("Missing [context.deploy-preview].ignore in netlify.toml.");
    return 1;
  }

  // Do not interpolate the untrusted head ref into shell code or forward CI
  // credentials. HEAD, not the base branch or synthetic merge ref, is tested.
  const result = spawnSync("sh", ["-c", command], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      HEAD: env.PR_HEAD_REF,
      BRANCH: "main",
    },
    encoding: "utf8",
    timeout: 5000,
  });
  if (result.error || result.status !== 0) {
    console.error(
      "Bot PR head is not skipped by netlify.toml [context.deploy-preview].ignore. " +
        "Add its lane pattern to the rule and its regression test before merging."
    );
    return 1;
  }
  console.log("Bot PR head is covered by the deploy-preview ignore rule.");
  return 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  process.exitCode = main();
}
