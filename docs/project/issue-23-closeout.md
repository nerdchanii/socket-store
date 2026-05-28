# Issue 23 Closeout

Issue: <https://github.com/nerdchanii/socket-store/issues/23>

Milestone: post-v1 stabilization

This note reconciles the connection status and reconnect strategy umbrella after
the stacked post-v1 work. It is maintainer-facing project metadata, not a public
runtime contract.

## Resolution

Issue #23 is complete when the dependent pull requests land in order:

- #65 defines the public connection status model.
- #66 adds `getStatus()` and `subscribeStatus(listener)`.
- #67 documents and tests that disconnected sends fail immediately without an
  implicit queue.
- #68 documents the future opt-in reconnect configuration shape.
- #69 documents authentication refresh and session recovery boundaries.
- #70 documents that advanced reconnect orchestration belongs in future
  `realtime-kit` planning.

The resulting package contract keeps reconnect behavior explicit and deferred:
`socket-store` exposes framework-agnostic status semantics now, rejects sends
while disconnected, and does not silently retry, queue, refresh credentials, or
resume sessions. Minimal bounded reconnect may be scoped later for
`socket-store`; advanced orchestration remains outside this package.

## Future SSOT Need

If reconnect work moves beyond documentation into an accepted implementation
plan, the package should record that accepted scope in a dedicated SPEC instead
of continuing to spread the boundary across closeout notes and release-era docs.

## Release Intent

No additional changeset is required for this closeout note. The public contract
changes already have changesets in the dependency stack, and this file only
records maintainer reconciliation under `docs/project/`.
