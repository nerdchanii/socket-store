# Documentation Style Guide

Use this guide before adding generated pages, public guides, or agent-readable
files.

## Writing Rules

- Document only behavior verified from source, tests, runnable examples, or an
  accepted issue contract.
- Prefer concrete examples over placeholder prose.
- Keep headings stable and descriptive so agents can link to them directly.
- Use present tense for supported behavior and future tense only for explicitly
  deferred work.
- Mark non-goals clearly instead of implying broad platform support.
- Do not include marketing filler, empty placeholder pages, or undocumented
  behavior claims.

## Source Checks

Before documenting an API guarantee, inspect the relevant source or tests:

- `src/SocketStore.ts` for store lifecycle, subscriptions, sending, and errors.
- `src/createMessageHandler.ts` for handler construction.
- `src/types.ts` for public TypeScript contracts.
- `src/*.test.ts` and `src/*.test-d.ts` for runtime and type expectations.
- `examples/` for runnable setup and cleanup behavior.

If the behavior is not covered by source or tests, either add coverage in the
implementation task or describe it as a limitation, not a guarantee.

## Agent-Readable Docs

Agent docs should help coding tools identify package purpose, entry points,
non-goals, examples, and canonical public docs without re-reading every source
file. They should link back to public pages instead of duplicating detailed API
contracts.

Do not describe MCP or A2A support as available. MCP may be discussed only as a
future docs-query integration. A2A protocol support is outside the current
package contract unless a future adapter issue explicitly scopes it.

## Examples

Examples must be runnable or copied from runnable files. Include the verification
command when practical, such as `npm run example:typecheck`, and summarize
expected inputs, outputs, and cleanup behavior when setup is lengthy.

## Snippet Verification

Public TypeScript fences in `README.md` and `docs/public/` are compiled by
`npm run docs:verify-snippets`.

Use ` ```ts no-verify ` only for explicit pseudocode, signatures, or partial
excerpts that are intentionally not standalone programs. Keep those exceptions
rare and reviewable.
