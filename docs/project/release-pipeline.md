# Release Pipeline

`socket-store` releases use Changesets, a release pull request, a manual publish
workflow, and a protected publish environment. Maintainers should not run local
publish commands for the normal release path.

## Command Order

1. Add a changeset to each pull request that changes supported consumer
   behavior, package contents, or public documentation contracts.
2. Merge feature and fix pull requests only after CI passes.
3. Let the `Release` workflow open or update the `Release socket-store` pull
   request after changesets land on `main`.
4. Review and merge the release pull request only after CI passes on that pull
   request.
5. Run the `Publish` workflow from `main` after the release pull request merges.
6. Approve the `npm-publish` environment for that workflow run.
7. Confirm npm, the matching git tag, and the GitHub Release all show the same
   package version.

## Publish Gate

The `Publish` workflow is manual and uses the protected `npm-publish`
environment. Publish cannot run until the workflow completes:

- `npm ci`
- `npm run lint`, including public snippet verification
- `npm run type-test`
- `npm run test`
- `npm run build`
- `npm run docs:build`
- `npm run pack:dry-run`

The publish command is `npx changeset publish` with
`NPM_CONFIG_PROVENANCE=true`. The workflow grants `id-token: write` so npm
provenance can be attached through GitHub Actions. The npm package should use
trusted publishing for this repository workflow instead of a long-lived npm
token.

## Tags And GitHub Releases

Changesets owns version commits, changelog entries, npm publish, package tags,
and GitHub Releases. For `socket-store@x.y.z`, the git tag and GitHub Release
must use the same `socket-store@x.y.z` version string that appears on npm.

## Adapter Release Order

When a `react-socket-store` release depends on a new `socket-store` public
contract, publish `socket-store` first. Open the adapter release only after the
new `socket-store` version is available on npm and the adapter dependency range
points at that released contract.

## Bad Release Response

Do not delete published versions. For a bad release:

1. Mark the npm version deprecated with a short reason.
2. Open a fix or revert pull request against `main`, or against the affected
   `release/<major>.<minor>` branch for a maintained patch line.
3. Add a patch changeset that describes the correction.
4. Publish the replacement version through the guarded release pipeline.
