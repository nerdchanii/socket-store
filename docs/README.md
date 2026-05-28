# Documentation Structure

This directory is the source of truth for the `socket-store` documentation site
published at <https://nerdchanii.github.io/socket-store/>. Keep pages in the
same structure the public docs site exposes.

## Intended Layout

- `docs/public/`: VitePress source for public user-facing guides, tutorials,
  migration notes, and API contract pages.
- `docs/public/.vitepress/`: VitePress configuration, navigation, theme hooks,
  and build-only site wiring. Do not put durable package guidance here.
- `docs/public/public/`: static assets copied by the docs site, such as images
  or downloadable examples. Avoid duplicating source files from `examples/`.
- `docs/agents/`: LLM-readable package context, indexes, structured metadata,
  and agent-facing guides such as `agent-context.json` and `guide.md`.
- `docs/project/`: maintainer-facing planning notes that should not be treated
  as public package documentation, including the
  [branch policy](./project/branch-policy.md) and
  [release pipeline](./project/release-pipeline.md).

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

GitHub Pages deploys the VitePress output from `docs/public/`, using the
`/socket-store/` project-site base path. Maintainer notes in `docs/project/`
are outside that VitePress source tree and are not deployed.
