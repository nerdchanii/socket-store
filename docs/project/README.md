---
title: Project Docs
doc_type: index
status: active
owner: maintainers
applies_to: socket-store
last_reviewed: 2026-05-29
---

# Project Docs

`docs/project/` contains maintainer-only operations docs. These files are not
part of the public package contract.

## Current Set

- [branch-policy.md](./branch-policy.md): branch families, maintenance branches, and backport
  rules.
- [release-policy.md](./release-policy.md): release eligibility, versioning intent, and release-line
  rules.
- [release-runbook.md](./release-runbook.md): the step-by-step release and publish flow.
- [templates/policy-template.md](./templates/policy-template.md): template for future policy docs.
- [templates/runbook-template.md](./templates/runbook-template.md): template for future runbooks.

## Rules

- Keep this folder limited to active maintainer operations.
- Put user-facing package guarantees in `docs/public/`, `docs/agents/`, or the
  package root docs.
- Do not keep closeout notes, historical reconciliation docs, or speculative
  architecture/process framing here.
