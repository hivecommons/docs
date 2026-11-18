- Optional Kapa.ai "Ask AI" widget on the docs pages, off by default. It loads only when
  `NEXT_PUBLIC_KAPA_WEBSITE_ID` (the public integration ID) is set at build time, and the
  Content-Security-Policy gains the Kapa hosts only in that case.
