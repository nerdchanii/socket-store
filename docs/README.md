# Documentation Structure

This directory is the source of truth for future `socket-store` documentation.
Until a documentation site is generated, keep pages here in the same structure
the site will expose.

## Intended Layout

- `docs/.vitepress/`: VitePress configuration, navigation, theme hooks, and
  build-only site wiring. Do not put durable package guidance here.
- `docs/public/`: static assets copied by the docs site, such as images or
  downloadable examples. Avoid duplicating source files from `examples/`.
- `docs/guide/`: public user-facing guides, tutorials, migration notes, and
  API contract pages.
- `docs/agents/`: LLM-readable package context, indexes, and structured files
  such as future `agent-context.json` or `llms.md`.
- `docs/project/`: maintainer-facing planning notes that should not be treated
  as public package documentation.

Root files keep their existing roles: `README.md` is the concise package
overview, `llms.txt` is the future high-signal agent index, and `examples/`
contains runnable examples that docs may reference but should not copy.

## Public Docs Versus Project Docs

Public docs explain the supported package contract: install, runtime behavior,
TypeScript usage, lifecycle, cleanup, errors, protocol adapters, examples, and
non-goals. They should be suitable for npm users and GitHub readers.

Agent-facing docs are public only when they describe stable package context or
canonical links. They must not expose private planning notes or imply support
for features that are still deferred.
