# Reconnect Behavior

Reconnect behavior is not implemented in the current runtime.

## What You Can Rely On Today

`socket-store` does not reconnect automatically after a socket closes or fails.

Today, you can rely on these behaviors:

- The store observes the `WebSocket` instance you provide. It does not create a
  replacement socket on its own.
- When the socket closes, connection status settles on `closed`.
- `send` succeeds only while the socket is `open`.
- Connecting, closing, and closed sockets reject `send` with
  `ERR_SOCKET_NOT_OPEN`.
- The runtime does not queue messages for later delivery.

If your application needs reconnect behavior today, it must create and manage
replacement `WebSocket` instances outside `socket-store`.

## Proposed Future Option

If reconnect support is added later, the documented shape is an explicit
`reconnect` option in the third `SocketStore` constructor argument:

```ts no-verify
type SocketStoreReconnectOptions = {
  enabled: true;
  maxAttempts?: number;
  backoff?: "fixed" | "exponential";
  initialDelayMs?: number;
  maxDelayMs?: number;
  retryOnClose?: (event: CloseEvent) => boolean;
};

new SocketStore(socket, handlers, {
  reconnect: {
    enabled: true,
    maxAttempts: 5,
    backoff: "exponential",
    initialDelayMs: 250,
    maxDelayMs: 5000,
  },
});
```

Reconnect must remain disabled unless `reconnect.enabled === true`. Omitting
`reconnect`, passing `false`, or passing an object without explicit opt-in must
preserve today's behavior.

## Retry And Backoff Semantics

If reconnect support is added, the first stable version should support only
bounded retry:

- `maxAttempts` counts replacement WebSocket attempts after the observed socket
  closes. The default should be finite.
- `backoff: "fixed"` waits `initialDelayMs` before every attempt.
- `backoff: "exponential"` doubles the previous delay until `maxDelayMs`.
- Delay values are milliseconds and should reject negative, infinite, or `NaN`
  values.
- Jitter, network reachability detection, automatic auth refresh, session
  recovery, replay, and offline send queues are deferred until a later issue
  explicitly scopes them.

## Close And Error Handling

Close events should drive retry decisions. A native `error` event should still
report `ERR_SOCKET_ERROR` through `onError`, but it should not start reconnect
without the following `close` event or an explicit future policy.

Manual `socket.close()` should remain terminal by default. A future
`retryOnClose` predicate may opt into retry for selected `CloseEvent` values;
when it returns `false`, status must become `closed` and no attempt is pending.

While an attempt is pending, status should move to `reconnecting`. While the
replacement socket is opening, status should move to `connecting`. Exhausting
retry attempts should move to `error` only when the runtime can prove the retry
policy has failed; otherwise it should settle on `closed`.

## What This Page Does Not Promise

This page does not add runtime reconnect support. It also does not define a
socket factory API, queued sends, persisted state recovery, or adapter-specific
React behavior.

## What Belongs Outside This Package

Minimal reconnect behavior may belong in `socket-store` when it is limited to
bounded replacement of a caller-supplied WebSocket and the existing topic-store
status model. That scope includes explicit opt-in, finite retry attempts,
simple backoff, close-event filtering, and immediate send rejection while the
store is not open.

Advanced reconnect behavior belongs outside `socket-store`. This includes
network reachability, jitter policy, offline queues, message replay, session
resumption, persisted snapshots, cross-tab coordination, protocol-level
acknowledgement, and app-wide auth/session orchestration.

`socket-store` should expose enough boundaries for a higher-level reconnect
manager to create fresh sockets, but it should not become that manager.

## Auth And Session Boundaries

`socket-store` receives a caller-created WebSocket. The current runtime does
not own credential lookup, token refresh, cookie rotation, or session renewal.
Applications that need fresh credentials must create the WebSocket with those
credentials before passing it to `SocketStore`.

Future reconnect support must keep that responsibility explicit. A reconnect
API may accept an application-provided socket factory or credential provider,
but `socket-store` must not infer how to refresh auth from the previous socket,
reuse expired connection state, or hide credential refresh inside generic retry
logic.

Session recovery is also application-owned until a later issue defines a
runtime contract. Reconnect attempts must not imply that missed server messages
are replayed, unsent client messages are queued, topic snapshots are reconciled,
or server-side sessions are resumed automatically.
