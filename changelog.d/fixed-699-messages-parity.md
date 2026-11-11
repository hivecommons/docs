- Removed 30 orphan translation keys from the `messages/*.json` locale bundles
  that no longer exist in `messages/en.json`, and added a vitest parity test
  that fails on keys missing from English or mismatched ICU placeholders
  (hivecommons/docs#699).
