import { describe, it, expect } from "vitest";
import { compileMdx } from "nextra/compile";
import { escapeStrayBraces } from "@/lib/escapeStrayBraces";
import { remarkStripMdxJs } from "@/lib/remarkStripMdxJs";

const compile = (src: string) =>
  compileMdx(src, { mdxOptions: { remarkPlugins: [remarkStripMdxJs] } });

describe("escapeStrayBraces", () => {
  it("lets a Go-template token in prose compile (fails without the escape)", async () => {
    const src = "Run --format {{.Mountpoint}} here.";
    await expect(compile(src)).rejects.toThrow();
    await expect(compile(escapeStrayBraces(src))).resolves.toBeTruthy();
  });

  it("lets a single-brace expression in prose compile", async () => {
    const src = "use {expr} here";
    await expect(compile(src)).resolves.toBeTruthy();
    expect(escapeStrayBraces(src)).toBe("use \\{expr\\} here");
    await expect(compile("use {a b} here")).rejects.toThrow();
    await expect(compile(escapeStrayBraces("use {a b} here"))).resolves.toBeTruthy();
  });

  it("leaves code spans, fences and tags untouched", () => {
    const src = [
      "inline `{{.Mountpoint}}` ok {x}",
      "",
      "```sh",
      "podman inspect --format '{{.Mountpoint}}'",
      "```",
      "",
      '<Tag prop={a} /> {/* note */}',
    ].join("\n");
    const out = escapeStrayBraces(src);
    expect(out).toContain("`{{.Mountpoint}}`");
    expect(out).toContain("'{{.Mountpoint}}'");
    expect(out).toContain("<Tag prop={a} />");
    expect(out).toContain("{/* note */}");
    expect(out).toContain("ok \\{x\\}");
  });

  it("is idempotent on already-escaped braces", () => {
    expect(escapeStrayBraces("a \\{b\\}")).toBe("a \\{b\\}");
  });
});
