import { describe, expect, it } from "vitest";
import { DESIGN_RECORD_SELECTOR, isDesignRecordPage } from "@/lib/designRecord";

describe("isDesignRecordPage", () => {
  it("marks Hive design records and ADRs", () => {
    expect(isDesignRecordPage("hive", "design/customers.md")).toBe(true);
    expect(isDesignRecordPage("hive", "adr/0014-hub-spoke.md")).toBe(true);
  });

  it("leaves operator pages and other projects unmarked", () => {
    expect(isDesignRecordPage("hive", "dashboard-sections.md")).toBe(false);
    expect(isDesignRecordPage("hive", "operator-reference/readme.md")).toBe(
      false
    );
    expect(isDesignRecordPage("crux", "design/notes.md")).toBe(false);
    expect(isDesignRecordPage(undefined, "design/customers.md")).toBe(false);
  });

  it("exposes the selector the Kapa source excludes", () => {
    expect(DESIGN_RECORD_SELECTOR).toBe('[data-docs-kind="design-record"]');
  });
});
