// Guards messages/*.json against drifting from messages/en.json. request.ts
// deep-merges each locale over en, so a locale may omit keys (English fallback
// is by design) but must not carry keys en no longer has, and shared strings
// must use the same ICU {placeholder} names.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MESSAGES_DIR = join(__dirname, "..", "..", "messages");

type Json = { [key: string]: unknown };

function load(file: string): Json {
  return JSON.parse(readFileSync(join(MESSAGES_DIR, file), "utf8")) as Json;
}

function flatten(obj: Json, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      out.set(path, value);
      for (const [p, v] of flatten(value as Json, path)) out.set(p, v);
    } else {
      out.set(path, value);
    }
  }
  return out;
}

function placeholders(value: string): string[] {
  const names = new Set<string>();
  for (const m of value.matchAll(/\{\s*([A-Za-z0-9_]+)/g)) names.add(m[1]);
  return [...names].sort();
}

const en = flatten(load("en.json"));
const locales = readdirSync(MESSAGES_DIR).filter(
  (f) => f.endsWith(".json") && f !== "en.json",
);

describe("messages parity with en.json", () => {
  it("finds locale bundles", () => {
    expect(locales.length).toBeGreaterThan(0);
  });

  describe.each(locales)("%s", (file) => {
    const locale = flatten(load(file));

    it("has no keys missing from en.json", () => {
      const orphans = [...locale.keys()].filter((k) => !en.has(k));
      expect(orphans).toEqual([]);
    });

    it("uses the same ICU placeholders as en.json", () => {
      const mismatches: string[] = [];
      for (const [key, value] of locale) {
        const source = en.get(key);
        if (typeof value !== "string" || typeof source !== "string") continue;
        const a = placeholders(value).join(",");
        const b = placeholders(source).join(",");
        if (a !== b) mismatches.push(`${key}: [${a}] != en [${b}]`);
      }
      expect(mismatches).toEqual([]);
    });
  });
});
