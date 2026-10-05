# Public knowledge MCP endpoint

Hive can publish a small, anonymous MCP endpoint for operational knowledge that
other agents can read without joining the hive. Use it when you want a
troubleshooting assistant, local coding agent, or support script to reason from
the hive's accumulated fixes, regressions, and integration notes instead of
only from model training data.

The endpoint is `POST /mcp/knowledge` on the spoke. It is available in
Hive v5.134.0 and later, shipped for
[hivecommons/hive#10615](https://github.com/hivecommons/hive/issues/10615)
by [hivecommons/hive#10621](https://github.com/hivecommons/hive/pull/10621).

> **Note:** this is currently controlled by environment variables. There is no
> dashboard toggle yet; a separate follow-up is tracking that operator UI.

## Turn it on or off

| Variable | Default | Effect |
| --- | --- | --- |
| `HIVE_PUBLIC_KNOWLEDGE` | disabled | Set to `1`, `true`, `yes`, or `on` to enable `POST /mcp/knowledge`. Any other value makes the path return `404`, even to the owner. |
| `HIVE_PUBLIC_KNOWLEDGE_TAGS` | all public-type facts | Optional comma-separated tag allow-list. When set, only facts carrying at least one listed tag are served. |

Hive reads both variables on every request, so an owner can close the surface
instantly by unsetting or changing `HIVE_PUBLIC_KNOWLEDGE`; a spoke restart is
not required.

Example Kubernetes patch:

```sh
kubectl -n hive set env deploy/hive HIVE_PUBLIC_KNOWLEDGE=1
kubectl -n hive set env deploy/hive HIVE_PUBLIC_KNOWLEDGE_TAGS=troubleshooting,linux
```

To close it:

```sh
kubectl -n hive set env deploy/hive HIVE_PUBLIC_KNOWLEDGE-
```

## What public means

Only operational fact types are eligible:

- `pattern`
- `gotcha`
- `regression`
- `test_scaffold`
- `integration`
- `coverage_rule`
- `general`

Ideation and governance facts are never served: `idea`, `vision`,
`constitution`, `requirement`, `constraint`, `stakeholder`, and `decision`.
Requests for a non-public slug return "not found" rather than revealing that a
private fact exists.

Public facts include only `slug`, `title`, `type`, `body`, `tags`, `related`,
and scored `confidence`. Hive strips source links, authors, usage counters,
confidence reasoning, and lifecycle phase. A fact's `related` list is also
filtered to slugs that are public under the same rules.

## MCP protocol and limits

The endpoint speaks MCP protocol `2025-06-18` over Streamable HTTP with plain
JSON responses.

| Limit | Value |
| --- | --- |
| HTTP method | `POST` only |
| Request body | 64 KiB maximum |
| JSON-RPC batching | Not supported |
| Search results | `knowledge_search` returns at most 50 facts |
| Writes | No write tools or mutation path |

The exposed tools are marked with `readOnlyHint: true`.

| Tool | Arguments | Returns |
| --- | --- | --- |
| `knowledge_search` | `query` required; optional `type`, `limit` | JSON `{query, count, results[]}` |
| `knowledge_get` | `slug` required | One public fact, or an MCP tool error saying the fact was not found |
| `knowledge_export` | none | Markdown export of the public base, grouped by type, with `_meta.etag` and `_meta.facts` |

## Connect agents

Replace `https://hive.example.org` with the public URL for your spoke.

### Goose

Add a Streamable HTTP extension to `~/.config/goose/config.yaml`:

```yaml
extensions:
  project-hive:
    type: streamable_http
    uri: https://hive.example.org/mcp/knowledge
    enabled: true
```

### Claude Desktop and Claude Code

Claude Code can register the HTTP MCP server directly:

```sh
claude mcp add --transport http project-hive https://hive.example.org/mcp/knowledge
```

For Claude Desktop, add the same URL as an HTTP MCP server in the app's MCP
server configuration and restart the app so it reloads the configuration.

### Copilot CLI

Add the server to `~/.copilot/mcp-config.json`:

```json
{
  "mcpServers": {
    "project-hive": {
      "type": "http",
      "url": "https://hive.example.org/mcp/knowledge"
    }
  }
}
```

### Raw curl

Initialize the MCP session:

```sh
curl -s https://hive.example.org/mcp/knowledge \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"curl","version":"1.0.0"}}}'
```

List the tools:

```sh
curl -s https://hive.example.org/mcp/knowledge \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}'
```

Search public knowledge:

```sh
curl -s https://hive.example.org/mcp/knowledge \
  -H 'Content-Type: application/json' \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"knowledge_search","arguments":{"query":"bluetooth regression","limit":5}}}'
```

## Verify it is working

1. With `HIVE_PUBLIC_KNOWLEDGE` unset, `POST /mcp/knowledge` should return
   `404`.
2. Set `HIVE_PUBLIC_KNOWLEDGE=1`.
3. Run the `tools/list` curl command above and confirm the three knowledge
   tools are present.
4. Run a `knowledge_search` for a tag or phrase you know exists.
5. If `HIVE_PUBLIC_KNOWLEDGE_TAGS` is set, search for an unlisted tag and
   confirm those facts are absent.
6. Unset `HIVE_PUBLIC_KNOWLEDGE` and confirm the endpoint returns `404` again
   without restarting the spoke.

## Security posture

This surface is anonymous but read-only. It exposes no create, update, delete,
import, promotion, vault, or GitHub write path, and it does not expose source
attribution or author data. Hosted hub front doors can pass `/mcp/knowledge`
through without a browser session, but the spoke still re-checks
`HIVE_PUBLIC_KNOWLEDGE` and returns `404` when the owner switch is off.

Treat the response body as public information. Before enabling the endpoint,
consider tag scoping with `HIVE_PUBLIC_KNOWLEDGE_TAGS`, review which operational
facts should be public, and use a reverse-proxy allow-list if only specific
agent networks should reach the endpoint.

## Related references

- [Environment variable reference](/docs/hive/env-vars)
- [Knowledge system ADR](/docs/hive/adr/0011-knowledge-system)
- [Upstream public knowledge MCP doc](https://github.com/hivecommons/hive/blob/v5/src/docs/public-knowledge-mcp.md)
- [Knowledge system design](https://github.com/hivecommons/hive/blob/v5/src/docs/design/knowledge-system.md)
- [hivecommons/hive#10615](https://github.com/hivecommons/hive/issues/10615)
- [hivecommons/hive#10621](https://github.com/hivecommons/hive/pull/10621)
