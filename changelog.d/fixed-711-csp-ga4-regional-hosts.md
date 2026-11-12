- GA4 `/g/collect` beacons to regional hosts (`region1.google-analytics.com`,
  `*.analytics.google.com`, `*.googletagmanager.com`) are now allowed in CSP
  `connect-src` (hivecommons/docs#711). Previously only `www.google-analytics.com`
  was listed, so regional beacons were CSP-blocked; same pattern as #532.
