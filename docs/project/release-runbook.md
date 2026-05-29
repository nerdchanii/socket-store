---
title: Release Runbook
doc_type: runbook
status: active
owner: maintainers
applies_to: socket-store
last_reviewed: 2026-05-29
source_of_truth: docs/project/release-runbook.md
---

# Release Runbook

## Purpose

Describe the required steps for cutting and publishing a `socket-store`
release.

## Preconditions

- The release target is `main` or an approved `release/<major>.<minor>` branch.
- Required release intent is already present in merged pull requests.
- The package version and changelog state are consistent with the intended
  release.

## Release Flow

1. Merge release-relevant pull requests only after CI passes.
2. Let the `Release` workflow open or update the automated release pull
   request.
3. Review the release pull request for version and changelog correctness.
4. Merge the release pull request only after its checks pass.
5. Run the manual `Publish` workflow from the branch being released.
6. Approve the `npm-publish` environment when prompted.
7. Confirm npm, the git tag, and the GitHub Release all show the same version.

## Required Checks

Before publish, the branch must pass:

- `npm ci`
- `npm run lint`
- `npm run type-test`
- `npm run test`
- `npm run build`
- `npm run docs:build`
- `npm run pack:dry-run`

## If A Check Fails

- Fix the root cause before continuing.
- Rerun the narrow failing command locally first, then the broader release set
  as needed.
- Do not weaken checks, skip tests, or edit generated output by hand just to
  get a release through.

## Publish Notes

- Publish runs through GitHub Actions, not local maintainer commands.
- Changesets owns the release pull request, version commit, npm publish, tags,
  and GitHub Release creation.
- Use trusted publishing with provenance enabled.
