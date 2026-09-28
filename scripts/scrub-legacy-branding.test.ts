import { describe, it, expect } from "vitest";
import { scrubLegacyBranding } from "./scrub-legacy-branding";

describe("scrubLegacyBranding", () => {
  it("rewrites transferred jumppad-labs repo sub-paths but not the Go module path", () => {
    expect(scrubLegacyBranding("https://github.com/jumppad-labs/spektacular/releases")).toBe(
      "https://github.com/hivecommons/spektacular/releases"
    );
    expect(scrubLegacyBranding("go install github.com/jumppad-labs/spektacular@latest")).toBe(
      "go install github.com/jumppad-labs/spektacular@latest"
    );
    expect(scrubLegacyBranding("https://github.com/jumppad-labs/tutorial-spektacular-how-to")).toBe(
      "https://github.com/jumppad-labs/tutorial-spektacular-how-to"
    );
  });

  it("rewrites KubeStellar branding and repo references", () => {
    expect(scrubLegacyBranding("KubeStellar hive at kubestellar.io")).toBe(
      "Hive Commons hive at hivecommons.dev"
    );
    expect(scrubLegacyBranding("github.com/kubestellar/hive")).toBe(
      "github.com/hivecommons/hive"
    );
    expect(scrubLegacyBranding("@kubestellar/foo")).toBe("@hivecommons/foo");
  });
});
