import { NextResponse } from "next/server";
import fs from "fs";
import { docsContentPath } from "../../docs/page-map";
import { logger } from "@/lib/logger";
import { recordApiRequest } from "@/lib/metrics";

// Readiness check for the docs app.
//
// The app's core dependency for serving traffic is the local docs content
// tree (see src/app/docs/page-map.ts). Every page render and the /api/search
// route read markdown files from `docsContentPath` at request time. If that
// directory is missing, empty, or unreadable (e.g. a bad container image
// build, a failed volume mount, or an incomplete version-branch checkout),
// the app can still return 200 on its normal routes while serving broken or
// empty documentation. This endpoint checks that dependency directly so an
// orchestrator or deploy pipeline can detect that condition before routing
// traffic to this instance.
export async function GET() {
  const startedAt = performance.now();
  const response = check();
  recordApiRequest(
    "healthz",
    "GET",
    response.status,
    performance.now() - startedAt
  );
  return response;
}

function check(): NextResponse {
  try {
    const stat = fs.statSync(docsContentPath);
    if (!stat.isDirectory()) {
      const reason = "docs content path is not a directory";
      logger.error("healthz check failed", {
        route: "healthz",
        method: "GET",
        status: 503,
        error: reason,
      });
      return NextResponse.json(
        { status: "unhealthy", reason },
        { status: 503 }
      );
    }

    const entries = fs.readdirSync(docsContentPath);
    if (entries.length === 0) {
      const reason = "docs content path is empty";
      logger.error("healthz check failed", {
        route: "healthz",
        method: "GET",
        status: 503,
        error: reason,
      });
      return NextResponse.json(
        { status: "unhealthy", reason },
        { status: 503 }
      );
    }

    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch (err) {
    // Raw fs errors embed absolute paths; keep them in the log, not the response.
    const reason = "docs content path is unreadable";
    logger.error("healthz check failed", {
      route: "healthz",
      method: "GET",
      status: 503,
      error: err instanceof Error ? err.message : reason,
    });
    return NextResponse.json({ status: "unhealthy", reason }, { status: 503 });
  }
}
