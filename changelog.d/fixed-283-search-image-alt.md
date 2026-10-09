- `/api/search` no longer leaks image alt text as a stray `!alt` token into
  indexed content and snippets: images are stripped before links, whose
  pattern also matched the tail of `![alt](src)` (hivecommons/docs#283).
