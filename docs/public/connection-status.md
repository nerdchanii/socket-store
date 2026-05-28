# Connection Status Model

`socket-store` exposes a framework-agnostic connection status API. Use
`getStatus()` for the current snapshot and `subscribeStatus(listener)` for
future status changes.

## Status Values

Status APIs use these public values:

- `connecting`: the store has a WebSocket that has not opened yet. This covers
  the initial native `CONNECTING` state only.
- `open`: the WebSocket has emitted `open` or was already in the native `OPEN`
  ready state when the store started observing it, and can send messages.
- `closing`: close has started, either because the native socket is closing or a
  future store-owned close operation has begun.
- `closed`: the connection is fully closed and no retry is pending.
- `reconnecting`: a future opt-in reconnect policy is waiting to create or open
  the next WebSocket after a close or network failure.
- `error`: the connection reached a terminal failure state that will not retry
  without user action.

`error` is a connection state, not a replacement for `SocketStoreError`.
Protocol, routing, handler, socket, and send failures should continue to use
`SocketStoreError` for error details.

## Transitions

The initial transition for a newly created WebSocket is:

```txt
connecting -> open -> closing -> closed
```

If a store starts observing a WebSocket that is already `OPEN`, the initial
public status is `open`.

The runtime API maps the socket's initial native `readyState` to public status:
`CONNECTING` becomes `connecting`, `OPEN` becomes `open`, `CLOSING` becomes
`closing`, and `CLOSED` becomes `closed`.

If the socket closes before `open`, the status becomes `closed` unless a future
opt-in reconnect policy schedules another attempt.

Future reconnect support may add these transitions:

```txt
open -> reconnecting -> connecting -> open
connecting -> reconnecting -> connecting
reconnecting -> closed
reconnecting -> error
```

Reconnect must be explicit and opt-in. `socket-store` must not silently create a
new WebSocket, retry forever, or queue outgoing messages unless a future API
asks for that behavior.

See [Reconnect Configuration Design](/reconnect) for the proposed opt-in
configuration shape, retry limits, backoff choices, close behavior, and
implementation boundaries.

## Close And Error Semantics

Native `close` events should move the model toward `closed` when no retry is
pending. The `CloseEvent` remains available through `onClose`.

Native `error` events should continue to report `ERR_SOCKET_ERROR` through
`onError`. A native error event alone does not prove the connection is terminal;
the following `close` event or reconnect policy decides whether the public
status becomes `closed`, `reconnecting`, or `error`.

`send` succeeds only while the socket is `open`. Connecting, closing, and closed
sockets reject sends immediately with `ERR_SOCKET_NOT_OPEN`. The runtime does
not serialize, send, or queue those messages for later delivery.

Future `reconnecting` and `error` states must follow the same default policy
unless a later explicit API adds a different send mode: sends are rejected with
`ERR_SOCKET_NOT_OPEN`, and no offline queue is created implicitly.

## Internal Details

These details are not part of the public model:

- Browser numeric `WebSocket.readyState` values.
- Backoff timers, retry counters, jitter, or socket factory internals.
- Authentication refresh and session recovery decisions.
- Advanced reconnect orchestration that belongs in future `realtime-kit`
  planning, such as reachability, replay, queues, and app-wide session policy.

Ambiguous states such as `paused`, `offline`, `retrying`, `failed`, and
`degraded` are deferred until a concrete runtime API requires them.
