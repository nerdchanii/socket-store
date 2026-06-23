---
title: Release Policy
doc_type: policy
status: active
owner: maintainers
applies_to: socket-store
last_reviewed: 2026-05-29
source_of_truth: docs/project/release-policy.md
---

# Release Policy

## Purpose

Define when `socket-store` changes are release-relevant and which release-line
rules maintainers follow.

## Rules

### Stable Branch

- `main` is the only default release branch.
- Every merge to `main` should keep the package releasable.
- Do not create long-lived integration branches such as `dev`.

### Release-Relevant Changes

Add release intent when a pull request changes supported consumer behavior,
package contents, or public docs contracts. Common release-relevant changes:

- runtime or type changes under `src/`
- export or packaging changes in `package.json`
- public docs updates that change supported usage or guarantees
- runnable example changes that intentionally change supported setup or behavior

Maintainer-only notes under `docs/project/` do not require release intent by
themselves.

### Versioning

- Use semver.
- Prefer `patch` for compatible bug fixes and packaging corrections.
- Prefer `minor` for additive public API or newly supported flows.
- Use `major` for breaking runtime, type, packaging, or migration-contract
  changes.

### Maintenance Branches

- Create `release/<major>.<minor>` only after a shipped minor line needs
  supported patch maintenance.
- Do not create maintenance branches preemptively.
- Once a maintenance branch exists, only critical bug fixes, security fixes,
  and release-blocking compatibility fixes may be backported.

### Prereleases

- Publish stable releases from `main` by default.
- Use prerelease tags only when maintainers intentionally need external testing
  of unreleased package behavior.

## Review Questions

- Does the change alter what npm consumers can rely on?
- Does the change need a version bump or changelog entry?
- Does the change belong on a maintenance branch, or only on `main`?
