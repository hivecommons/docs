// Shared legacy-branding rewrite rules used by both sync-hive-docs.ts and
// sync-sibling-docs.ts when pulling markdown content in from upstream repos
// that still carry pre-rename (KubeStellar) branding/URLs.
export function scrubLegacyBranding(content: string): string {
  return content
    .replace(/io\.kubestellar\.hive\./g, "io.hivecommons.hive.")
    .replace(/hive\\?\.kubestellar\\?\.io/g, (m) =>
      m.includes("\\") ? "hive\\.hivecommons\\.dev" : "hive.hivecommons.dev")
    .replace(/examples\/kubestellar-fixer\.md/g, "examples/hivecommons-fixer.md")
    .replace(/examples\/kubestellar\//g, "examples/hivecommons/")
    .replace(/@kubestellar\//g, "@hivecommons/")
    .replace(/github\.com\/kubestellar\/hive/g, "github.com/hivecommons/hive")
    .replace(/github\.com\/kubestellar/g, "github.com/hivecommons")
    .replace(/kubestellar\/hive/g, "hivecommons/hive")
    .replace(/kubestellar\/pluk/g, "hivecommons/pluk")
    .replace(/kubestellar\/hotshot/g, "hivecommons/hotshot")
    // Spektacular transferred from jumppad-labs. Only rewrite repo sub-paths
    // (releases, issues, blob): the Go module path is still
    // github.com/jumppad-labs/spektacular and the Homebrew tap still lives
    // under jumppad-labs, so `go install ...@latest` and `brew install` must
    // keep their original targets. Other jumppad-labs repos (the tutorial's
    // example project) were not transferred and keep their URLs.
    .replace(/github\.com\/jumppad-labs\/spektacular\//g, "github.com/hivecommons/spektacular/")
    .replace(/github\.com\/jumppad-labs\/spektacular-website\//g, "github.com/hivecommons/spektacular-website/")
    .replace(/kubestellar\.io/g, "hivecommons.dev")
    .replace(/KubeStellar/g, "Hive Commons")
    .replace(/Kubestellar/g, "Hive Commons")
    .replace(/kubestellar/g, "hivecommons");
}
