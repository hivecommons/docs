- Synced sibling-project pages (hotshot, pluk, rationguard, promptargs, dibs,
  Spektacular) now resolve `../` links against the source file, keep `?query`
  suffixes, and rewrite reference-style `[id]: target` links, matching the
  Hive docs sync (hivecommons/docs#339). Previously such links pointed at
  wrong GitHub URLs.
