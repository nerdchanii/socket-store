# Agent Guide

Use this guide when making agent-authored changes to `socket-store`. It points
to canonical docs and source references without replacing them.

## Read Order

1. Start with [`llms.txt`](../../llms.txt) for the shortest package map.
2. Use [`agent-context.json`](./agent-context.json) for machine-readable
   package purpose, entry points, examples, boundaries, and non-goals.
3. Use the [API contract](../guide/api.md) for public runtime and type
   semantics.
4. Use the [runnable example](../guide/example.md) for setup, expected message
   flow, and cleanup behavior.
5. Use the [documentation style guide](../style-guide.md) before editing public
   docs.

## Source References

Check source before documenting or changing behavior:

- `src/SocketStore.ts` for store lifecycle, subscriptions, sending, and errors.
- `src/createMessageHandler.ts` for topic handler construction.
- `src/types.ts` for exported TypeScript contracts.
- `src/SocketStore.test.ts` and `src/schema.test-d.ts` for tested runtime and
  type behavior.
- `examples/basic` for runnable example behavior.

Do not copy full API details into this guide. Link to the API contract and
source files so future changes have one canonical place to update.

## Runtime Boundary

`socket-store` owns the framework-agnostic WebSocket topic store. React hooks,
React render timing, and React Server Component boundaries belong to
`react-socket-store`.

Do not describe A2A protocol support as available. It is outside the current
package contract unless a future adapter issue explicitly scopes it.

## MCP Evaluation Note

MCP is a deferred docs-query integration decision, not runtime scope for
`socket-store`.

Evaluate MCP only after the public docs, examples, `llms.txt`, and
`agent-context.json` are stable enough to query. A future MCP task should define
the server shape, supported queries, verification commands, and maintenance
owner before adding any MCP files or claims.
