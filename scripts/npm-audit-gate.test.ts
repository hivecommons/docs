import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  collectAdvisories,
  evaluateAudit,
  ghsaIdFromUrl,
  loadExceptions,
  main,
  type AuditException,
} from "./npm-audit-gate";

const BRACES_URL = "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm";

// Shape mirrors `npm audit --omit=dev --json` for a transitive chain
// nextra -> fast-glob -> micromatch -> braces where only braces carries the
// advisory object; the rest list their vulnerable dependency as a string.
const REPORT = {
  auditReportVersion: 2,
  vulnerabilities: {
    braces: {
      name: "braces",
      severity: "high",
      via: [
        {
          source: 1105443,
          name: "braces",
          title: "braces vulnerable to stack-exhaustion denial of service",
          url: BRACES_URL,
          severity: "high",
          range: "*",
        },
      ],
    },
    micromatch: { name: "micromatch", severity: "high", via: ["braces"] },
    "fast-glob": { name: "fast-glob", severity: "high", via: ["micromatch"] },
    nextra: { name: "nextra", severity: "high", via: ["fast-glob"] },
    "some-lib": {
      name: "some-lib",
      severity: "moderate",
      via: [
        {
          source: 42,
          name: "some-lib",
          title: "ReDoS",
          url: "https://github.com/advisories/GHSA-aaaa-bbbb-cccc",
          severity: "moderate",
        },
      ],
    },
  },
};

const NOW = new Date("2026-10-03T00:00:00Z");

function exception(over: Partial<AuditException> = {}): AuditException {
  return {
    id: "GHSA-vfj7-8cjw-p6xm",
    package: "braces",
    reason: "no patched release",
    expires: "2027-01-01",
    ...over,
  };
}

describe("ghsaIdFromUrl", () => {
  it("extracts and upper-cases the GHSA id", () => {
    expect(ghsaIdFromUrl(BRACES_URL)).toBe("GHSA-VFJ7-8CJW-P6XM");
  });
  it("returns null for non-GHSA urls or undefined", () => {
    expect(ghsaIdFromUrl("https://example.com/x")).toBeNull();
    expect(ghsaIdFromUrl(undefined)).toBeNull();
  });
});

describe("collectAdvisories", () => {
  it("collects only root advisory objects, deduplicated", () => {
    const advs = collectAdvisories(REPORT);
    expect(advs.map((a) => a.id).sort()).toEqual([
      "GHSA-AAAA-BBBB-CCCC",
      "GHSA-VFJ7-8CJW-P6XM",
    ]);
    const braces = advs.find((a) => a.package === "braces")!;
    expect(braces.severity).toBe("high");
    expect(braces.url).toBe(BRACES_URL);
  });
  it("tolerates an empty report and advisories without urls", () => {
    expect(collectAdvisories({})).toEqual([]);
    const advs = collectAdvisories({
      vulnerabilities: { x: { severity: "low", via: [{ source: 7 }] } },
    });
    expect(advs).toEqual([
      { id: "npm-7", package: "x", severity: "low", title: "", url: "" },
    ]);
  });
});

describe("evaluateAudit", () => {
  it("blocks high advisories with no exception and ignores lower ones", () => {
    const r = evaluateAudit(REPORT, [], "high", NOW);
    expect(r.blocking.map((a) => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.belowLevel.map((a) => a.id)).toEqual(["GHSA-AAAA-BBBB-CCCC"]);
    expect(r.excepted).toEqual([]);
  });

  it("passes when every high advisory is covered by an active exception", () => {
    const r = evaluateAudit(REPORT, [exception()], "high", NOW);
    expect(r.blocking).toEqual([]);
    expect(r.excepted.map((a) => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.unused).toEqual([]);
  });

  it("matches ids case-insensitively and without a package filter", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ id: "ghsa-vfj7-8cjw-p6xm", package: undefined })],
      "high",
      NOW
    );
    expect(r.blocking).toEqual([]);
  });

  it("does not apply an exception scoped to a different package", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ package: "micromatch" })],
      "high",
      NOW
    );
    expect(r.blocking.map((a) => a.id)).toEqual(["GHSA-VFJ7-8CJW-P6XM"]);
    expect(r.unused).toHaveLength(1);
  });

  it("reports expired exceptions and keeps the advisory blocking", () => {
    const r = evaluateAudit(
      REPORT,
      [exception({ expires: "2026-01-01" })],
      "high",
      NOW
    );
    expect(r.expired).toHaveLength(1);
    expect(r.blocking).toHaveLength(1);
  });

  it("flags malformed entries", () => {
    const r = evaluateAudit(
      REPORT,
      [
        exception({ id: "CVE-2024-1" }),
        exception({ reason: "" }),
        exception({ expires: "not-a-date" }),
        { id: "GHSA-vfj7-8cjw-p6xm", reason: "ok" } as AuditException,
      ],
      "high",
      NOW
    );
    expect(r.invalid).toHaveLength(4);
  });

  it("reports unused active exceptions", () => {
    const r = evaluateAudit(
      REPORT,
      [exception(), exception({ id: "GHSA-zzzz-zzzz-zzzz", package: "nope" })],
      "high",
      NOW
    );
    expect(r.unused.map((e) => e.id)).toEqual(["GHSA-zzzz-zzzz-zzzz"]);
  });

  it("honours the level threshold", () => {
    expect(evaluateAudit(REPORT, [], "moderate", NOW).blocking).toHaveLength(2);
    expect(evaluateAudit(REPORT, [], "critical", NOW).blocking).toHaveLength(0);
  });

  it("rejects unknown levels", () => {
    expect(() => evaluateAudit(REPORT, [], "severe", NOW)).toThrow(
      /Unknown audit level/
    );
  });
});

describe("loadExceptions", () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-gate-"));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("returns [] when the file is missing", () => {
    expect(loadExceptions(path.join(dir, "none.json"))).toEqual([]);
  });
  it("parses an array", () => {
    const f = path.join(dir, "ex.json");
    fs.writeFileSync(f, JSON.stringify([exception()]));
    expect(loadExceptions(f)).toHaveLength(1);
  });
  it("rejects a non-array document", () => {
    const f = path.join(dir, "ex.json");
    fs.writeFileSync(f, "{}");
    expect(() => loadExceptions(f)).toThrow(/expected a JSON array/);
  });
});

describe("main", () => {
  let dir: string;
  let cwdSpy: ReturnType<typeof vi.spyOn>;
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;
  let errSpy: ReturnType<typeof vi.spyOn>;

  function write(rel: string, data: unknown) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, JSON.stringify(data));
    return abs;
  }

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "npm-audit-gate-main-"));
    cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(dir);
    exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => undefined) as never);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    cwdSpy.mockRestore();
    exitSpy.mockRestore();
    logSpy.mockRestore();
    errSpy.mockRestore();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("exits 2 without a report argument", () => {
    main([]);
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it("exits 1 on an unacknowledged high advisory", () => {
    const report = write("audit.json", REPORT);
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(errSpy.mock.calls.flat().join("\n")).toMatch(/without an exception/);
  });

  it("passes when the exceptions file covers the advisory and warns on unused", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception(),
      exception({ id: "GHSA-zzzz-zzzz-zzzz", package: "nope" }),
    ]);
    main([report, "--level=high"]);
    expect(exitSpy).not.toHaveBeenCalled();
    const out = logSpy.mock.calls.flat().join("\n");
    expect(out).toMatch(/Acknowledged 1 advisory/);
    expect(out).toMatch(/::warning::Unused npm audit exception GHSA-zzzz/);
    expect(out).toMatch(/Ignoring 1 advisory/);
    expect(out).toMatch(/passed at level "high"/);
  });

  it("fails on expired and malformed exceptions", () => {
    const report = write("audit.json", REPORT);
    write(".github/npm-audit-exceptions.json", [
      exception({ expires: "2000-01-01" }),
      { id: "nope" },
    ]);
    main([report]);
    expect(exitSpy).toHaveBeenCalledWith(1);
    const err = errSpy.mock.calls.flat().join("\n");
    expect(err).toMatch(/Expired npm audit exceptions/);
    expect(err).toMatch(/Malformed exception entries/);
  });
});
