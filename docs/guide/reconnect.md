# Reconnect Configuration Design

Reconnect behavior is not implemented in the current runtime. This page defines
the supported shape for a future opt-in API so reconnect semantics are explicit
before runtime work starts.

## Proposed Option

Future reconnect support should live under `reconnect` in the third
`SocketStore` constructor argument:

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
preserve today's behavior: the supplied WebSocket closes, status becomes
`closed`, and sends continue to fail immediately while the socket is not open.

## Retry And Backoff Semantics

The first stable runtime should support only bounded retry:

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

## Scope Boundaries

This design does not add runtime reconnect support. It also does not define a
socket factory API, queued sends, persisted state recovery, adapter-specific
React behavior, or umbrella `realtime-kit` behavior.

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
