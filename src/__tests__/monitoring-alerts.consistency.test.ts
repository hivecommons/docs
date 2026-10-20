// Guards the hand-maintained Prometheus rules in monitoring/docs-api-alerts.yml
// against the metrics that src/lib/metrics.ts actually exports. The rule file
// is inert in this repository (nothing here loads it), so a renamed metric,
// a dropped label or a removed route value would never fail a build: the
// alert would simply stop matching any series and go silent in production.
// This is the earliest point such drift can fail a PR:
//   - every metric an `expr` references must be a series the registry emits
//     (including the `_bucket`/`_sum`/`_count` series of the histogram);
//   - every label matcher and `by (...)` grouping must use a label that
//     series carries, and `route` / `status_class` values must be ones
//     recordApiRequest can produce (ApiRoutes, and the status_class values the registry
//     really emits when probed with 2xx/3xx/4xx/5xx/other statuses);
//   - every rule links a runbook section that exists, and every runbook
//     section belongs to a rule, so on-call never lands on a missing anchor.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ApiRoutes, metricsRegistry, recordApiRequest } from "@/lib/metrics";

const REPO_ROOT = join(__dirname, "..", "..");
const RULES_PATH = join(REPO_ROOT, "monitoring", "docs-api-alerts.yml");
const RULES_TEXT = readFileSync(RULES_PATH, "utf8");

const RUNBOOK_URL_PREFIX = "https://github.com/hivecommons/docs/blob/main/";
const SEVERITIES = new Set(["warning", "critical"]);

interface AlertRule {
  name: string;
  expr: string;
  for?: string;
  severity?: string;
  runbookUrl?: string;
  summary?: string;
}

// The rule file is a flat Prometheus rule group, so a line-oriented reader is
// enough; the repo has no YAML parser among its declared dependencies and the
// test should not pull one in for this.
export function parseAlertRules(yaml: string): AlertRule[] {
  const rules: AlertRule[] = [];
  const lines = yaml.split("\n");
  let current: AlertRule | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const alert = line.match(/^\s*-\s*alert:\s*(\S+)\s*$/);
    if (alert) {
      current = { name: alert[1], expr: "" };
      rules.push(current);
      continue;
    }
    if (current === null) continue;
    const exprBlock = line.match(/^(\s*)expr:\s*\|\s*$/);
    if (exprBlock) {
      const indent = exprBlock[1].length;
      const body: string[] = [];
      while (i + 1 < lines.length) {
        const next = lines[i + 1];
        const nextIndent = next.match(/^(\s*)/)![1].length;
        if (next.trim() !== "" && nextIndent <= indent) break;
        body.push(next.trim());
        i++;
      }
      current.expr = body.filter(Boolean).join(" ");
      continue;
    }
    const inlineExpr = line.match(/^\s*expr:\s*(.+?)\s*$/);
    if (inlineExpr) {
      current.expr = inlineExpr[1];
      continue;
    }
    const kv = line.match(/^\s*([a-z_]+):\s*(.+?)\s*$/);
    if (!kv) continue;
    const value = kv[2].replace(/^"(.*)"$/, "$1");
    if (kv[1] === "for") current.for = value;
    else if (kv[1] === "severity") current.severity = value;
    else if (kv[1] === "runbook_url") current.runbookUrl = value;
    else if (kv[1] === "summary") current.summary = value;
  }
  return rules;
}

/** `metric{a="x",b!="y"}` references found in a PromQL expression. */
export function metricReferences(
  expr: string
): { metric: string; matchers: Record<string, string> }[] {
  const refs: { metric: string; matchers: Record<string, string> }[] = [];
  const re = /\b([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?/g;
  for (const m of expr.matchAll(re)) {
    if (!m[1].startsWith("docs_api_")) continue;
    const matchers: Record<string, string> = {};
    for (const part of (m[2] ?? "").split(",")) {
      const kv = part
        .trim()
        .match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(=~|!~|!=|=)\s*"(.*)"$/);
      if (kv) matchers[kv[1]] = kv[3];
    }
    refs.push({ metric: m[1], matchers });
  }
  return refs;
}

/** Label names used in `by (...)` / `without (...)` aggregation clauses. */
export function groupingLabels(expr: string): string[] {
  const labels: string[] = [];
  for (const m of expr.matchAll(/\b(?:by|without)\s*\(([^)]*)\)/g)) {
    for (const l of m[1].split(",")) {
      const name = l.trim();
      if (name) labels.push(name);
    }
  }
  return labels;
}

/** Series name -> label names, read from the registry's own exposition. */
export function exportedSeries(exposition: string): Map<string, Set<string>> {
  const series = new Map<string, Set<string>>();
  for (const raw of exposition.split("\n")) {
    if (raw === "" || raw.startsWith("#")) continue;
    const m = raw.match(/^([a-zA-Z_:][a-zA-Z0-9_:]*)(?:\{([^}]*)\})?\s/);
    if (!m) continue;
    const labels = series.get(m[1]) ?? new Set<string>();
    for (const part of (m[2] ?? "").split(",")) {
      const kv = part.trim().match(/^([a-zA-Z_][a-zA-Z0-9_]*)=/);
      if (kv) labels.add(kv[1]);
    }
    series.set(m[1], labels);
  }
  return series;
}

/** Distinct values of one label across the exposition. */
export function labelValues(exposition: string, label: string): Set<string> {
  const values = new Set<string>();
  const re = new RegExp(`[{,]${label}="([^"]*)"`, "g");
  for (const raw of exposition.split("\n")) {
    if (raw === "" || raw.startsWith("#")) continue;
    for (const m of raw.matchAll(re)) values.add(m[1]);
  }
  return values;
}

// One status per class statusClass() distinguishes, including the fallthrough.
const PROBE_STATUSES = [200, 301, 404, 503, 999];

async function emitted(): Promise<{
  series: Map<string, Set<string>>;
  statusClasses: Set<string>;
}> {
  metricsRegistry.resetMetrics();
  for (const status of PROBE_STATUSES) {
    recordApiRequest("search", "GET", status, 5);
  }
  try {
    const exposition = await metricsRegistry.metrics();
    return {
      series: exportedSeries(exposition),
      statusClasses: labelValues(exposition, "status_class"),
    };
  } finally {
    metricsRegistry.resetMetrics();
  }
}

async function emittedSeries(): Promise<Map<string, Set<string>>> {
  return (await emitted()).series;
}

const rules = parseAlertRules(RULES_TEXT);

describe("monitoring/docs-api-alerts.yml", () => {
  it("parses at least one rule and every rule has a unique name", () => {
    expect(rules.length).toBeGreaterThan(0);
    const names = rules.map(r => r.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("gives every rule an expr, a for duration, a known severity and a summary", () => {
    for (const rule of rules) {
      expect(rule.expr, `${rule.name} expr`).not.toBe("");
      expect(rule.for, `${rule.name} for`).toMatch(/^\d+[smhd]$/);
      expect(
        SEVERITIES.has(rule.severity ?? ""),
        `${rule.name} severity ${rule.severity}`
      ).toBe(true);
      expect(rule.summary, `${rule.name} summary`).toBeTruthy();
    }
  });

  it("only references series the metrics registry actually emits", async () => {
    const series = await emittedSeries();
    for (const rule of rules) {
      const refs = metricReferences(rule.expr);
      expect(
        refs.length,
        `${rule.name} references no docs_api_ metric`
      ).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(
          series.has(ref.metric),
          `${rule.name}: ${ref.metric} is not exported by src/lib/metrics.ts (have ${[...series.keys()].join(", ")})`
        ).toBe(true);
      }
    }
  });

  it("only uses label names the referenced series carry", async () => {
    const series = await emittedSeries();
    for (const rule of rules) {
      const refs = metricReferences(rule.expr);
      const available = new Set<string>();
      for (const ref of refs) {
        const labels = series.get(ref.metric) ?? new Set<string>();
        for (const l of labels) available.add(l);
        for (const key of Object.keys(ref.matchers)) {
          expect(
            labels.has(key),
            `${rule.name}: ${ref.metric} has no label ${key}`
          ).toBe(true);
        }
      }
      for (const label of groupingLabels(rule.expr)) {
        expect(
          available.has(label),
          `${rule.name}: groups by ${label}, which none of its series carry`
        ).toBe(true);
      }
    }
  });

  it("only matches route and status_class values recordApiRequest can produce", async () => {
    const { statusClasses } = await emitted();
    const routes = new Set<string>(ApiRoutes);
    for (const rule of rules) {
      for (const ref of metricReferences(rule.expr)) {
        if ("route" in ref.matchers) {
          expect(
            routes.has(ref.matchers.route),
            `${rule.name}: route="${ref.matchers.route}" is not in ApiRoutes`
          ).toBe(true);
        }
        if ("status_class" in ref.matchers) {
          expect(
            statusClasses.has(ref.matchers.status_class),
            `${rule.name}: status_class="${ref.matchers.status_class}" is never emitted (have ${[...statusClasses].join(", ")})`
          ).toBe(true);
        }
      }
    }
  });

  it("links every rule to an existing runbook section named after the alert", () => {
    for (const rule of rules) {
      expect(rule.runbookUrl, `${rule.name} runbook_url`).toBeDefined();
      const url = rule.runbookUrl!;
      expect(url.startsWith(RUNBOOK_URL_PREFIX), `${rule.name}: ${url}`).toBe(
        true
      );
      const [relPath, anchor] = url.slice(RUNBOOK_URL_PREFIX.length).split("#");
      const abs = join(REPO_ROOT, relPath);
      expect(existsSync(abs), `${rule.name}: ${relPath} missing`).toBe(true);
      expect(anchor, `${rule.name}: anchor`).toBe(rule.name.toLowerCase());
      const headings = readFileSync(abs, "utf8")
        .split("\n")
        .filter(l => l.startsWith("## "))
        .map(l => l.slice(3).trim());
      expect(
        headings,
        `${rule.name}: no "## ${rule.name}" in ${relPath}`
      ).toContain(rule.name);
    }
  });

  it("has no runbook section without a matching rule", () => {
    const runbooks = new Set(
      rules
        .map(r => r.runbookUrl?.slice(RUNBOOK_URL_PREFIX.length).split("#")[0])
        .filter((p): p is string => Boolean(p))
    );
    const names = new Set(rules.map(r => r.name));
    for (const rel of runbooks) {
      const headings = readFileSync(join(REPO_ROOT, rel), "utf8")
        .split("\n")
        .filter(l => l.startsWith("## "))
        .map(l => l.slice(3).trim());
      for (const h of headings) {
        expect(names.has(h), `${rel}: section "${h}" has no alert rule`).toBe(
          true
        );
      }
    }
  });
});

describe("parseAlertRules", () => {
  it("reads block and inline exprs, quoted values and stops at the next rule", () => {
    const parsed = parseAlertRules(
      [
        "groups:",
        "  - name: g",
        "    rules:",
        "      - alert: A",
        "        expr: |",
        "          up == 0",
        "            or absent(up)",
        "        for: 5m",
        "        labels:",
        "          severity: critical",
        "        annotations:",
        '          summary: "A fired"',
        "      - alert: B",
        "        expr: rate(x[5m]) > 1",
        "        for: 1h",
        "",
      ].join("\n")
    );
    expect(parsed).toEqual([
      {
        name: "A",
        expr: "up == 0 or absent(up)",
        for: "5m",
        severity: "critical",
        summary: "A fired",
      },
      { name: "B", expr: "rate(x[5m]) > 1", for: "1h" },
    ]);
  });

  it("ignores keys that appear before the first rule", () => {
    expect(parseAlertRules("for: 1m\nseverity: x\n")).toEqual([]);
  });
});

describe("metricReferences / groupingLabels / exportedSeries", () => {
  it("extracts metric names with their matchers, skipping functions and non-docs metrics", () => {
    expect(
      metricReferences(
        'sum by (route) (rate(docs_api_requests_total{status_class="5xx",route!~"x"}[5m])) / rate(up[5m])'
      )
    ).toEqual([
      {
        metric: "docs_api_requests_total",
        matchers: { status_class: "5xx", route: "x" },
      },
    ]);
    expect(metricReferences("docs_api_foo > 1")).toEqual([
      { metric: "docs_api_foo", matchers: {} },
    ]);
  });

  it("lists by/without labels and tolerates empty groups", () => {
    expect(
      groupingLabels("sum by (le, route) (x) + sum without(job) (y)")
    ).toEqual(["le", "route", "job"]);
    expect(groupingLabels("sum by () (x)")).toEqual([]);
  });

  it("collects distinct label values from the exposition", () => {
    expect(
      [...labelValues('m{a="1",b="2"} 1\nm{a="3"} 1\n# m{a="x"} 1', "a")].sort()
    ).toEqual(["1", "3"]);
  });

  it("maps exposition lines to their label names and skips comments", () => {
    const series = exportedSeries(
      [
        "# HELP m help",
        "# TYPE m counter",
        'm{a="1",b="2"} 1',
        "plain 3",
        "",
      ].join("\n")
    );
    expect([...series.get("m")!]).toEqual(["a", "b"]);
    expect([...series.get("plain")!]).toEqual([]);
  });
});
