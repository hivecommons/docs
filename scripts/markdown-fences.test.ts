import { describe, it, expect } from "vitest";
import { normalizeFences, DEFAULT_FENCE_LANGUAGE } from "./markdown-fences";

describe("normalizeFences", () => {
  it("adds the default language to a bare fence opener (MD040)", () => {
    const input = "Intro\n\n```\ncode\n```\n\nAfter\n";
    expect(normalizeFences(input)).toBe(
      `Intro\n\n\`\`\`${DEFAULT_FENCE_LANGUAGE}\ncode\n\`\`\`\n\nAfter\n`
    );
  });

  it("leaves an opener that already declares a language alone", () => {
    const input = "```bash\necho hi\n```\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("inserts blank lines around a fence glued to paragraphs (MD031)", () => {
    const input = "Run:\n```sh\nls\n```\nDone.\n";
    expect(normalizeFences(input)).toBe("Run:\n\n```sh\nls\n```\n\nDone.\n");
  });

  it("does not double up blank lines that are already there", () => {
    const input = "Run:\n\n```sh\nls\n```\n\nDone.\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("handles indented fences inside list items", () => {
    const input = "- item\n  ```\n  code\n  ```\n- next\n";
    expect(normalizeFences(input)).toBe(
      `- item\n\n  \`\`\`${DEFAULT_FENCE_LANGUAGE}\n  code\n  \`\`\`\n\n- next\n`
    );
  });

  it("never rewrites lines inside a fence, including nested backticks", () => {
    const input = "````md\n```\ninner\n```\n````\n";
    expect(normalizeFences(input)).toBe(input);
  });

  it("supports tilde fences", () => {
    const input = "x\n~~~\ncode\n~~~\ny\n";
    expect(normalizeFences(input)).toBe(`x\n\n~~~${DEFAULT_FENCE_LANGUAGE}\ncode\n~~~\n\ny\n`);
  });

  it("leaves a fence that closes the document unchanged apart from the language", () => {
    const input = "text\n```\ncode\n```";
    expect(normalizeFences(input)).toBe(`text\n\n\`\`\`${DEFAULT_FENCE_LANGUAGE}\ncode\n\`\`\``);
  });
});
