import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { logger } from "@/lib/logger";
import { recordApiRequest } from "@/lib/metrics";

const DOCS_CONTENT_PATH = path.join(process.cwd(), "docs", "content");

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

/** Per-response CSP for SVG: no scripts, opaque origin when opened directly. */
const SVG_CSP = "default-src 'none'; style-src 'unsafe-inline'; sandbox";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const startedAt = performance.now();
  let status = 200;
  try {
    const { path: pathSegments } = await params;
    const imagePath = pathSegments.join("/");

    // Security: prevent directory traversal
    if (imagePath.includes("..")) {
      status = 403;
      return new NextResponse("Forbidden", { status });
    }

    const fullPath = path.join(DOCS_CONTENT_PATH, imagePath);

    // Check if file exists and is within docs/content (trailing sep prevents sibling-dir prefix confusion)
    if (!fullPath.startsWith(DOCS_CONTENT_PATH + path.sep)) {
      status = 403;
      return new NextResponse("Forbidden", { status });
    }

    // Only known image types are served; anything else under docs/content
    // (page sources, config) is not reachable through this route.
    const ext = path.extname(fullPath).toLowerCase();
    const mimeType = MIME_TYPES[ext];
    if (!mimeType) {
      status = 404;
      return new NextResponse("Not Found", { status });
    }

    if (!fs.existsSync(fullPath)) {
      status = 404;
      return new NextResponse("Not Found", { status });
    }

    const fileBuffer = fs.readFileSync(fullPath);

    const headers: Record<string, string> = {
      "Content-Type": mimeType,
      "Cache-Control": "public, max-age=31536000, immutable",
    };
    if (mimeType === "image/svg+xml") {
      // SVG can carry inline script. The site-wide CSP allows 'unsafe-inline',
      // so sandbox the document when it is navigated to directly; <img>
      // rendering is unaffected.
      headers["Content-Security-Policy"] = SVG_CSP;
      headers["Content-Disposition"] = "inline";
    }

    return new NextResponse(fileBuffer, { headers });
  } catch (error) {
    status = 500;
    logger.error("docs-image request failed", {
      route: "docs-image",
      method: "GET",
      status,
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Internal Server Error", { status });
  } finally {
    const durationMs = performance.now() - startedAt;
    recordApiRequest("docs-image", "GET", status, durationMs);
  }
}
