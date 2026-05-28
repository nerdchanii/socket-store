# Agent-Readable Docs

Use these files as navigation context for agent-authored changes. They point to
canonical public docs and source-backed examples without replacing them.

## Agent Entry Points

- [`llms.txt`](https://github.com/nerdchanii/socket-store/blob/main/llms.txt):
  shortest public index for agents and semantic search tools.
- [`docs/agents/agent-context.json`](https://github.com/nerdchanii/socket-store/blob/main/docs/agents/agent-context.json):
  machine-readable package purpose, entry points, examples, boundaries, and
  non-goals.
- [`docs/agents/guide.md`](https://github.com/nerdchanii/socket-store/blob/main/docs/agents/guide.md):
  read order, source references, runtime boundary, and MCP evaluation note.

## Canonical Sources

- [API Contract](/api) documents public runtime and type semantics.
- [Runnable Example](/example) documents setup, expected messages, and cleanup
  behavior for the basic WebSocket topic-store example.
- [`README.md`](https://github.com/nerdchanii/socket-store#readme) remains the
  concise package overview for GitHub and npm readers.

## Scope

Agent-readable docs are navigation and context files. Keep API guarantees in
source-backed public docs, generated declarations, examples, and tests.

MCP is a future docs-query integration decision, not runtime scope for
`socket-store`. A2A protocol support is not part of the current package
contract.
