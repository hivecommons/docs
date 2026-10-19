import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const ADR_RE = /adr\/(\d{4}-[a-z0-9-]+\.md)/g;

function adrEntries(file: string): string[] {
  const src = fs.readFileSync(path.join(process.cwd(), file), "utf8");
  return [...new Set([...src.matchAll(ADR_RE)].map(m => m[1]))].sort();
}

describe("hive ADR navigation stays in step with sync-hive-docs", () => {
  it("lists every synced ADR in NAV_STRUCTURE_HIVE", () => {
    const synced = adrEntries("scripts/sync-hive-docs.ts");
    const inNav = adrEntries("src/app/docs/page-map.ts");
    expect(synced.length).toBeGreaterThan(0);
    expect(inNav).toEqual(synced);
  });
});
