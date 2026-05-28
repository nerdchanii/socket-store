# socket-store

`socket-store` is a small WebSocket-first topic state store. It routes incoming
messages by topic and lets each topic handler turn a payload into the next local
snapshot.

Use this guide as the public docs entrypoint. The package README remains the
canonical API overview until dedicated guide pages are added from source and
test inspection.

## Documentation

- [API Reference](/api): public entry points, runtime semantics, error codes,
  and current limitations.
- [Connection Status](/connection-status): public status values, transitions,
  close/error semantics, and reconnect expectations.
- [Reconnect Configuration](/reconnect): the current reconnect boundary, the
  proposed opt-in configuration shape, and application-owned auth/session
  responsibilities.
- [Runnable Example](/example): clean-checkout setup, expected WebSocket
  messages, browser behavior, and cleanup.
- [README](https://github.com/nerdchanii/socket-store#readme): install, default
  protocol, lifecycle, errors, custom protocol adapters, examples, and
  migration notes.
- [Runnable example](https://github.com/nerdchanii/socket-store/tree/main/examples/basic):
  browser client and WebSocket echo server using the default topic envelope.
