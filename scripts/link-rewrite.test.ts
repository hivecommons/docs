import { describe, it, expect } from "vitest";
import {
  rewriteImageTarget,
  rewriteLinkTarget,
  rewriteMarkdownLinks,
  splitSuffix,
  type LinkRewriteOptions,
} from "./link-rewrite";

const BLOB = "https://github.com/o/r/blob/main";
const RAW = "https://raw.githubusercontent.com/o/r/main";

const opts: LinkRewriteOptions = {
  sourceRepoPath: "docs/guide/page.md",
  blobBase: BLOB,
  resolveSyncedRoute: resolved =>
    resolved === "docs/intro.md" ? "/docs/p/intro" : undefined,
};

describe("splitSuffix", () => {
  it("splits on the first ? or #", () => {
    expect(splitSuffix("a.md?x=1#y")).toEqual({
      pathPart: "a.md",
      suffix: "?x=1#y",
    });
    expect(splitSuffix("a.md#y?z")).toEqual({
      pathPart: "a.md",
      suffix: "#y?z",
    });
    expect(splitSuffix("a.md")).toEqual({ pathPart: "a.md", suffix: "" });
  });
});

describe("rewriteLinkTarget", () => {
  it("resolves ../ against the source directory before routing", () => {
    expect(rewriteLinkTarget("../intro.md#top", opts)).toBe(
      "/docs/p/intro#top"
    );
  });

  it("sends unsynced targets to the blob base with the suffix kept", () => {
    expect(rewriteLinkTarget("../../src/a.go?plain=1", opts)).toBe(
      `${BLOB}/src/a.go?plain=1`
    );
  });

  it("passes the original path part to the resolver", () => {
    const seen: string[] = [];
    rewriteLinkTarget("./x/y.md?q", {
      ...opts,
      resolveSyncedRoute: (resolved, pathPart) => {
        seen.push(resolved, pathPart);
        return undefined;
      },
    });
    expect(seen).toEqual(["docs/guide/x/y.md", "./x/y.md"]);
  });

  it("leaves absolute, root-absolute, anchor and empty targets alone", () => {
    for (const t of ["https://x.y", "mailto:a@b", "//cdn/x", "/a", "#b", ""]) {
      expect(rewriteLinkTarget(t, opts)).toBe(t);
    }
    expect(rewriteLinkTarget("?only=query", opts)).toBe("?only=query");
  });
});

describe("rewriteImageTarget", () => {
  it("points relative sources at the raw base", () => {
    expect(
      rewriteImageTarget("../img/a.png?v=2", opts.sourceRepoPath, RAW)
    ).toBe(`${RAW}/docs/img/a.png?v=2`);
  });

  it("leaves absolute sources alone", () => {
    expect(rewriteImageTarget("https://x.y/a.png", "README.md", RAW)).toBe(
      "https://x.y/a.png"
    );
  });
});

describe("rewriteMarkdownLinks", () => {
  const md =
    '[i](../intro.md) ![a](../img/a.png "alt")\n[ref]: ../intro.md?x#y\n';

  it("treats images like links when no raw base is given", () => {
    expect(rewriteMarkdownLinks(md, opts)).toBe(
      `[i](/docs/p/intro) ![a](${BLOB}/docs/img/a.png "alt")\n[ref]: /docs/p/intro?x#y\n`
    );
  });

  it("rewrites images to raw URLs when a raw base is given", () => {
    expect(rewriteMarkdownLinks(md, { ...opts, rawBase: RAW })).toBe(
      `[i](/docs/p/intro) ![a](${RAW}/docs/img/a.png "alt")\n[ref]: /docs/p/intro?x#y\n`
    );
  });

  it("rewrites the outer link of a linked image", () => {
    expect(
      rewriteMarkdownLinks("[![b](b.svg)](../intro.md)", {
        ...opts,
        rawBase: RAW,
      })
    ).toBe(`[![b](${RAW}/docs/guide/b.svg)](/docs/p/intro)`);
  });
});
