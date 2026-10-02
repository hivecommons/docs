# The agent Terminal window

**Every agent card has a Terminal view: a live browser window onto that agent's `tmux` session, served by [ttyd](https://github.com/tsl0922/ttyd) and rendered with [xterm.js](https://xtermjs.org/).** It shows exactly what the agent's CLI sees and lets an operator intervene directly in the pane.

## Copying text out of it

The Terminal page is not an ordinary web page, so the browser's usual mouse and keyboard behavior is partly intercepted:

1. **`tmux` mouse mode owns an ordinary drag** — that is what lets the scroll wheel page back through history instead of selecting text. Hold **⇧ Shift** while dragging to bypass it and make a normal terminal selection.
2. **xterm.js keeps that selection in its own model, not in the page**, so the browser's Copy command previously had nothing of the pane to serialize.

With the selection made, **⌘C** (macOS) or **Ctrl+Shift+C** (Linux/Windows) copies it — the Terminal page answers that gesture (and the browser's Edit ▸ Copy menu item) itself. A plain **Ctrl+C** is deliberately left alone: it is still sent to the agent's pane as SIGINT. Pasting back in uses the browser's own paste gesture: **⌘V** or **Ctrl+Shift+V**.

This works on hive `v5` builds that include the fix for [hivecommons/hive#9941](https://github.com/hivecommons/hive/issues/9941) (commit `7ea9325` and later). On older builds, selecting text tries to copy automatically on selection change, which browsers that require a user gesture for clipboard access (for example Firefox) silently refuse — the selection looks copied but the clipboard still holds whatever was there before.

## Copying a login URL

For an OAuth/login link, prefer the dashboard's **🔑 Copy login URL** button on the agent card instead of selecting it in the Terminal. It captures the pane server-side and rejoins wrapped lines, so the URL arrives whole; a Shift-drag selection of a line-wrapped URL copies the wrap's newlines along with it, and the link silently fails at the identity provider.

## Troubleshooting

- **Paste produces old clipboard content, not what you selected.** Confirm the selection was made with Shift-drag (not a plain drag, which `tmux` mouse mode consumes) and that the copy gesture was ⌘C / Ctrl+Shift+C or Edit ▸ Copy, not a plain Ctrl+C.
- **Firefox specifically.** Clipboard writes outside a user gesture are blocked by Firefox; if copying still does not work after upgrading, confirm the hive is on a build after [hivecommons/hive#9950](https://github.com/hivecommons/hive/pull/9950).
- **Not served over HTTPS.** `navigator.clipboard` requires a secure context; a hive reachable only over plain HTTP falls back to a manual-selection copy that some browsers still refuse the same way older builds did.

See also: [Troubleshooting](troubleshooting.md#copying-text-out-of-the-browser-terminal) for the full write-up this page summarizes.
