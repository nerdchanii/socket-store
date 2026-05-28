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
- `closed`: the connection is fully closed.
- `reconnecting`: reserved for a future opt-in reconnect feature. The current
  runtime does not emit this status.
- `error`: reserved for a future terminal reconnect failure state. The current
  runtime does not emit this status.

`error` is a connection state, not a replacement for `SocketStoreError`.
Protocol, routing, handler, socket, and send failures should continue to use
`SocketStoreError` for error details.

## Transitions

Today, the status flow for a newly created WebSocket is:

```txt
connecting -> open -> closing -> closed
```

If a store starts observing a WebSocket that is already `OPEN`, the initial
public status is `open`.

The runtime API maps the socket's initial native `readyState` to public status:
`CONNECTING` becomes `connecting`, `OPEN` becomes `open`, `CLOSING` becomes
`closing`, and `CLOSED` becomes `closed`.

If the socket closes before `open`, the status becomes `closed`.

If a future opt-in reconnect feature is added, it may introduce transitions
such as:

```txt
open -> reconnecting -> connecting -> open
connecting -> reconnecting -> connecting
reconnecting -> closed
reconnecting -> error
```

Reconnect is not part of the current runtime. `socket-store` does not silently
create a new WebSocket, retry in the background, or queue outgoing messages for
later delivery.

See [Reconnect Behavior](/reconnect) for the current reconnect limitation and
the proposed opt-in API shape documented for future work.

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

## Not Exposed By Status APIs

These details are not part of the public model:

- Browser numeric `WebSocket.readyState` values.
- Backoff timers, retry counters, jitter, or socket factory internals.
- Authentication refresh and session recovery decisions.
- Higher-level reconnect orchestration, such as reachability, replay, queues,
  and app-wide session policy.

Ambiguous states such as `paused`, `offline`, `retrying`, `failed`, and
`degraded` are deferred until a concrete runtime API requires them.
