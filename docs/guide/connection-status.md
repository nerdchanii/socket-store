# Connection Status Model

`socket-store` does not currently expose a connection status API. This page
defines the public status model that future runtime APIs should follow before
status subscriptions, React hooks, or reconnect behavior are implemented.

## Status Values

Future status APIs should use these public values:

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

## Close And Error Semantics

Native `close` events should move the model toward `closed` when no retry is
pending. The `CloseEvent` remains available through `onClose`.

Native `error` events should continue to report `ERR_SOCKET_ERROR` through
`onError`. A native error event alone does not prove the connection is terminal;
the following `close` event or reconnect policy decides whether the public
status becomes `closed`, `reconnecting`, or `error`.

`send` while not `open` keeps its current behavior: it throws
`ERR_SOCKET_NOT_OPEN`. A future status API must not imply message buffering.

## Internal Details

These details are not part of the public model:

- Browser numeric `WebSocket.readyState` values.
- Backoff timers, retry counters, jitter, or socket factory internals.
- Authentication refresh and session recovery decisions.
- Whether future reconnect support belongs in `socket-store`,
  `react-socket-store`, or `realtime-kit`.

Ambiguous states such as `paused`, `offline`, `retrying`, `failed`, and
`degraded` are deferred until a concrete runtime API requires them.
