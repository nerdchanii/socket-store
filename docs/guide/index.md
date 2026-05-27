# socket-store

`socket-store` is a small WebSocket-first topic state store. It routes incoming
messages by topic and lets each topic handler turn a payload into the next local
snapshot.

Use this guide as the public docs entrypoint. The package README remains the
canonical API overview until dedicated guide pages are added from source and
test inspection.

## Current Public Docs

- [README](https://github.com/nerdchanii/socket-store#readme): install, default
  protocol, lifecycle, errors, custom protocol adapters, examples, migration
  notes, and non-goals.
- [Runnable example](https://github.com/nerdchanii/socket-store/tree/main/examples/basic):
  browser client and WebSocket echo server using the default topic envelope.

## Planned Sections

Future public pages should cover the source-backed API contract, runnable
examples, migration notes, and agent-readable package context. Do not publish
project maintenance notes from `docs/project/` in this site.

