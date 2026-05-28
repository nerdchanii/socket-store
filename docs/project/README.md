# Project Docs

`docs/project/` is for maintainer-facing notes that should not appear in the
public package docs.

Use this folder for project memory, release workflow references, and closeout
notes that explain why a decision or sequence existed at the time it landed.
Do not treat these files as the public package contract.

## File Guide

- `branch-policy.md`: the current branch and maintenance-branch rules for day to
  day repository work.
- `check-failure-playbook.md`: how to triage local or CI check failures without
  weakening verification.
- `release-intent.md`: when a pull request needs a changeset versus the `No
  release needed` PR marker.
- `release-pipeline.md`: the guarded release and publish workflow for
  maintainers.
- `issue-23-closeout.md`: historical closeout record for the connection status
  and reconnect umbrella issue.

## When A SPEC Would Be The Right SSOT

This folder intentionally stops short of a full SPEC or ADR system. If the
project later accepts long-lived process or architecture rules that multiple
maintainer docs must follow, the source of truth should move into a dedicated
SPEC and these notes should link to it instead of restating the same rule.

The clearest future SPEC candidates in the current repository are:

- accepted branch and release-line policy
- release-intent and release-pipeline rules
- accepted reconnect scope boundaries if reconnect work moves beyond docs-only
  guidance
