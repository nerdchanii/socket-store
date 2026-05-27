# AGENTS.md

This repository is the framework-agnostic `socket-store` package. Keep changes
small, issue-scoped, and aligned with the public package contract.

## Documentation Workflow

Read `docs/style-guide.md` before editing documentation. It defines the writing
standard for public docs, project docs, and agent-readable docs.

Use the docs layout from `docs/README.md`:

- Public package docs belong under `docs/guide/` or the root `README.md`.
- Static docs assets belong under `docs/public/`.
- Agent-readable package context belongs under `docs/agents/`.
- Maintainer and contributor workflow notes belong under `docs/project/`.
- VitePress configuration belongs under `docs/.vitepress/`.

Do not mix planning history into public package docs. Public docs should describe
supported behavior, examples, API contracts, migration notes, and non-goals.
Project docs may describe maintainer workflow, issue sequencing, and local
verification guidance. Agent-only workflow rules belong in this file.

## Verification Workflow

Treat package checks as executable conventions. Do not weaken lint, typecheck,
test, build, or packaging checks just to make a task pass.

Relevant package scripts are defined in `package.json`. Current checks include:

- `npm run lint`
- `npm run typecheck`
- `npm run example:typecheck`
- `npm run type-test`
- `npm test`
- `npm run build`
- `npm run pack:dry-run`

When a check fails, use `docs/project/check-failure-playbook.md` to decide
whether the fix belongs in implementation, tests, docs, tooling, or a follow-up
report. Include the command and first relevant error lines when reporting an
unrelated failure.

## Package Boundaries

Do not publish npm releases, rename the package, or move this repository into a
monorepo unless explicitly requested.

`react-socket-store` adapter behavior belongs in the adapter repository.
`socket-store` owns WebSocket message routing, topic snapshots, subscriptions,
protocol adapters, error reporting, and core TypeScript contracts.

