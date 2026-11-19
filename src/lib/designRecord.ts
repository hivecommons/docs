import type { ProjectId } from "@/config/versions";

// Design records (RFCs, proposals) and ADRs describe proposed or historical
// behaviour, so an AI answer engine that ingests the site would present them as
// how Hive works today. ADRs share a URL prefix, but synced design records sit
// in the Reference section next to operator pages, so a URL rule cannot tell
// them apart. Each such page carries this hidden marker; the Kapa website
// source excludes pages containing DESIGN_RECORD_SELECTOR
// (hivecommons/hive#19182). People still see and can link to these pages.
export const DESIGN_RECORD_ATTRIBUTE = "data-docs-kind";
export const DESIGN_RECORD_VALUE = "design-record";
export const DESIGN_RECORD_SELECTOR = `[${DESIGN_RECORD_ATTRIBUTE}="${DESIGN_RECORD_VALUE}"]`;

export function isDesignRecordPage(
  projectId: ProjectId | undefined,
  filePath: string
): boolean {
  return projectId === "hive" && /^(design|adr)\//.test(filePath);
}
