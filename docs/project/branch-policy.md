# Branch Policy

`socket-store` uses trunk-based development with release maintenance branches.
The goal is to keep `main` close to the published package behavior while still
allowing patch backports for maintained minor lines.

## Branch Roles

- `main`: the default trunk branch. It must stay release-ready after every
  merge, with tests and packaging checks passing before a pull request lands.
- `codex/*`, `feature/*`, `fix/*`, and `docs/*`: short-lived work branches for
  pull requests. Create them from the current `main` unless the work is a
  maintenance backport or hotfix.
- `release/<major>.<minor>`: protected maintenance branches for patch releases
  on an existing minor line, such as `release/1.2`.
- `hotfix/*`: active emergency fix branches. Start from `main` for the current
  release line, or from the relevant `release/<major>.<minor>` branch when the
  fix targets a maintained older minor.

Do not introduce a default `dev` branch or an `experimental/*` branch family.
Long-lived integration branches drift from the package contract and should not
be used for normal development.

## Normal Development Flow

1. Branch from the latest `main` using the smallest branch family that matches
   the work: `docs/*` for documentation, `fix/*` for defects, `feature/*` for
   scoped improvements, or `codex/*` for agent-owned tasks.
2. Open a pull request into `main` and keep the branch current enough for CI and
   review to reflect the code that will merge.
3. Merge only after the branch satisfies the issue contract and normal package
   verification expectations.
4. Delete the short-lived branch after merge unless another open pull request is
   explicitly stacked on it.

## Release Maintenance Flow

Use `release/<major>.<minor>` only after a minor line needs supported patch
maintenance. Release branches are protected and should reflect the package state
for that maintained minor line.

Patch work for a release branch should be cherry-picked or recreated from
already-reviewed changes on `main` when possible. If a fix must land on a
release branch first, follow up by applying the same fix to `main` unless the
maintainer explicitly records why it does not apply.

## Hotfix Flow

Use `hotfix/*` for urgent production fixes that cannot wait for the normal
release cadence.

1. Start from the branch that represents the affected release line.
2. Keep the patch limited to the emergency fix and its verification.
3. Open the pull request against that same release line.
4. Backport or forward-port the fix to every still-supported branch that is
   affected.
5. Delete the hotfix branch only after all required release-line pull requests
   have merged.

## Cleanup Rules

Automatic cleanup may delete merged, inactive short-lived branches in these
families:

- `codex/*`
- `feature/*`
- `fix/*`
- `docs/*`

Automatic cleanup must not delete:

- `main`
- `release/*`
- active `hotfix/*`
- branches used as the base for an open stacked pull request

Stale branch cleanup should prefer closing or retargeting obsolete pull requests
before deleting their source branches.
