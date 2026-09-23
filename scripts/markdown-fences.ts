/**
 * Fenced-code-block normalisation shared by the docs sync scripts.
 *
 * The upstream repos are linted loosely (or not at all), but this site runs
 * markdownlint with MD031 (blank lines around fences) and MD040 (fences must
 * declare a language) enabled because both rules also mark constructs that
 * break the MDX compiler used to render synced pages. Rather than fight every
 * upstream author, the sync normalises the fences at import time so the
 * committed copies under docs/content/ always satisfy the two rules.
 */

/** Language applied to a fence opener that does not declare one (MD040). */
export const DEFAULT_FENCE_LANGUAGE = "text";

const FENCE_RE = /^(\s*)(`{3,}|~{3,})(.*)$/;

interface OpenFence {
  marker: string;
}

function isFenceCloser(open: OpenFence, marker: string, info: string): boolean {
  return (
    marker[0] === open.marker[0] &&
    marker.length >= open.marker.length &&
    info.trim() === ""
  );
}

/**
 * Ensure every fenced code block declares a language and is surrounded by
 * blank lines. Fence content is never touched; only opener lines and the
 * lines adjacent to a fence are rewritten.
 */
export function normalizeFences(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let open: OpenFence | null = null;

  for (const line of lines) {
    const m = line.match(FENCE_RE);
    if (open) {
      out.push(line);
      if (m && isFenceCloser(open, m[2], m[3])) {
        open = null;
        // MD031: a closer needs a blank line after it. We cannot look ahead
        // without buffering, so the check happens when the next line lands.
        out.push("\0AFTER_FENCE");
      }
      continue;
    }

    if (out.length > 0 && out[out.length - 1] === "\0AFTER_FENCE") {
      out.pop();
      if (line.trim() !== "") out.push("");
    }

    if (m) {
      const [, indent, marker, info] = m;
      // A backtick fence whose info string contains a backtick is not a
      // fence per CommonMark; leave it alone.
      if (marker[0] === "`" && info.includes("`")) {
        out.push(line);
        continue;
      }
      // MD031: blank line before the opener.
      if (out.length > 0 && out[out.length - 1].trim() !== "") out.push("");
      // MD040: language on the opener.
      const lang = info.trim() === "" ? DEFAULT_FENCE_LANGUAGE : info.trimStart();
      out.push(`${indent}${marker}${lang}`);
      open = { marker };
      continue;
    }

    out.push(line);
  }

  if (out.length > 0 && out[out.length - 1] === "\0AFTER_FENCE") out.pop();
  return out.join("\n");
}
