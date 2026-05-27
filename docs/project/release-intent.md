# Release Intent

`socket-store` now uses Changesets to make version bumps and changelog entries
explicit in pull request review.

## When A Changeset Is Required

Add a changeset when a pull request changes supported consumer behavior, package
contents, or public docs contract. Typical cases:

- `src/` runtime or type changes.
- `package.json` packaging or export changes.
- `README.md`, `docs/guide/`, `docs/agents/`, or `llms.txt` updates that change
  supported usage, API guidance, or documented guarantees.
- Runnable example changes in `examples/` that intentionally change supported
  setup or behavior.

## When `No Release Needed` Is Acceptable

Use the PR template marker only for changes that do not affect consumers, such
as maintainer docs under `docs/project/`, CI/workflow changes, or internal test
coverage updates with no supported behavior change. Leave a short explanation in
the PR notes when using the marker.

## Bump Guidance

- `patch`: bug fixes, packaging fixes, and compatible docs-contract corrections.
- `minor`: additive public API, new documented capabilities, or new supported
  example flows.
- `major`: breaking API, runtime, packaging, or migration-contract changes.

## Release PR Workflow

Pushes to `main` run the Changesets GitHub Action. When unreleased changesets
exist, the action opens or updates a release pull request that contains version
and changelog updates for review before any publish step is introduced.
