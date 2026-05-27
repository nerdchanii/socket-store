# Check Failure Playbook

Use this playbook when a local check or CI check fails while working on
`socket-store`. If script names change, inspect `package.json` before following
older docs.

## Check Commands

- `npm run lint`: production typecheck plus example typecheck.
- `npm run typecheck`: TypeScript check for package source.
- `npm run example:typecheck`: TypeScript check for `examples/basic`.
- `npm run type-test`: compile-time public API assertions.
- `npm test`: runtime tests.
- `npm run build`: ESM and CommonJS package build.
- `npm run pack:dry-run`: prepack verification plus package contents preview.

CI runs install, typecheck, example typecheck, type-level tests, runtime tests,
build, and package dry-run. Local work should run the narrow failing command
first, then the broader relevant command before pushing.

## Triage Rules

Fix the root cause. Do not weaken checks, remove assertions, skip tests, or add
inline disables just to make a task pass. A narrow exception is acceptable only
when the file's purpose requires it and the exception is documented in config or
near the assertion.

Use the failure class to choose the fix:

- Lint or `typecheck`: fix implementation types, exported contracts, imports,
  unused production declarations, or compiler configuration.
- `example:typecheck`: fix the runnable example or update the example when the
  supported API intentionally changes.
- `type-test`: fix public type contracts or the type assertion when the intended
  API changed.
- `test`: fix runtime behavior first; update tests only when the issue contract
  intentionally changes behavior.
- `build`: fix source or build configuration. Do not edit generated `dist/`
  output by hand.
- `pack:dry-run`: verify generated output and package contents. If it fails
  because of local npm cache permissions, rerun with a temporary cache and report
  the original cache error.

## Reporting Unrelated Failures

If a failure is unrelated to the current issue, do not hide it in the patch.
Report it with:

- the exact command,
- the failing step,
- the first relevant error lines,
- whether the failure reproduces after a clean checkout or temporary cache, and
- why it is outside the current issue scope.

If the unrelated failure blocks CI for the PR, stop and fix it only when the
root cause is in the changed files. Otherwise, leave the PR unmerged and create
or link a follow-up issue with the command and error summary.

