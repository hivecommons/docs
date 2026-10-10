import { describe, it, expect } from "vitest";
import { scrubLegacyBranding } from "./scrub-legacy-branding";

describe("scrubLegacyBranding", () => {
  it("rewrites transferred jumppad-labs repo sub-paths but not the Go module path", () => {
    expect(
      scrubLegacyBranding(
        "https://github.com/jumppad-labs/spektacular/releases"
      )
    ).toBe("https://github.com/hivecommons/spektacular/releases");
    expect(
      scrubLegacyBranding(
        "go install github.com/jumppad-labs/spektacular@latest"
      )
    ).toBe("go install github.com/jumppad-labs/spektacular@latest");
    expect(
      scrubLegacyBranding(
        "https://github.com/jumppad-labs/tutorial-spektacular-how-to"
      )
    ).toBe("https://github.com/jumppad-labs/tutorial-spektacular-how-to");
  });

  it("rewrites the hive domain in both plain and regex-escaped forms", () => {
    expect(scrubLegacyBranding("https://hive.kubestellar.io/docs")).toBe(
      "https://hive.hivecommons.dev/docs"
    );
    // Upstream docs embed the domain inside regex literals; the escaped form
    // must stay escaped after the rewrite.
    expect(scrubLegacyBranding("/hive\\.kubestellar\\.io/")).toBe(
      "/hive\\.hivecommons\\.dev/"
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

  it("keeps the ghcr.io/kubestellar mirror org intact (docs#180)", () => {
    expect(
      scrubLegacyBranding(
        "`ghcr.io/hivecommons/hive` and `ghcr.io/kubestellar/hive`"
      )
    ).toBe("`ghcr.io/hivecommons/hive` and `ghcr.io/kubestellar/hive`");
    expect(scrubLegacyBranding("ghcr.io/kubestellar/hive-hub:stable")).toBe(
      "ghcr.io/kubestellar/hive-hub:stable"
    );
  });
});
