# API Contract

This page documents the public `socket-store` contract exported from the package
entrypoint:

```ts
import {
  SocketStore,
  createMessageHandler,
  SocketStoreError,
} from "socket-store";
```

The claims below are backed by `src/index.ts`, `src/SocketStore.ts`,
`src/createMessageHandler.ts`, `src/types.ts`, `src/SocketStore.test.ts`, and
`src/schema.test-d.ts`.

## Topic Schemas

Signature:

```ts
type SocketSchema = {
  [topic: string]: {
    state: unknown;
    payload: unknown;
  };
};
```

Behavior contract:

- A schema maps each topic key to the stored state type and incoming payload
  type for that topic.
- Passing a finite schema to `SocketStore<Schema>` constrains handler keys,
  `getState`, `subscribe`, `subscribeAll`, and `send`.
- Omitting the generic keeps loose legacy usage where topic names and payloads
  are not type-checked.

Example:

```ts
type ChatMessage = { author: string; text: string };

type AppSchema = {
  chat: { state: ChatMessage[]; payload: ChatMessage };
  price: { state: number | null; payload: { symbol: string; value: number } };
};
```

Useful exported schema types:

```ts
type ChatKey = TopicKey<AppSchema>;
type ChatState = TopicState<AppSchema, "chat">;
type ChatPayload = TopicPayload<AppSchema, "chat">;
type ChatHandler = TopicHandler<AppSchema, "chat">;
type AppUpdate = TopicUpdate<AppSchema>;
```

## createMessageHandler

Import path:

```ts
import { createMessageHandler } from "socket-store";
```

Signature:

```ts
function createMessageHandler<S, D, K extends string>(
  key: K,
  callback: (state: S, data: D) => S,
  state: S
): MessageHandler<S, D, K>;
```

Behavior contract:

- `key` is the topic name routed by `SocketStore`.
- `state` is the initial snapshot for that topic.
- `callback` receives the current state and incoming payload, then returns the
  next state. Returning `void` is rejected by TypeScript when the state type is
  explicit.
- Duplicate handler keys fail during `SocketStore` construction before socket
  listeners are attached.

Example:

```ts
const chatHandler = createMessageHandler(
  "chat",
  (state: ChatMessage[], payload: ChatMessage) => [...state, payload],
  [] as ChatMessage[]
);
```

## SocketStore

Import path:

```ts
import { SocketStore } from "socket-store";
```

Constructor signature:

```ts
new SocketStore<Schema>(
  socket: WebSocket,
  messageHandlers: SocketStoreMessageHandlers<Schema>,
  options?: ISocketStoreOptions<Schema>
);
```

Behavior contract:

- The store accepts an existing `WebSocket` instance and registers `open`,
  `message`, `error`, and `close` listeners.
- Each handler creates one topic snapshot in the internal store.
- Handler keys named like prototype properties, such as `toString` and
  `__proto__`, are supported as first-time topic keys.
- Duplicate handler keys throw `Error`.

Example:

```ts
const socket = new WebSocket("wss://example.com/realtime");
const store = new SocketStore<AppSchema>(socket, [chatHandler]);
```

### getState

Signature:

```ts
store.getState<K extends TopicKey<Schema>>(key: K): TopicState<Schema, K>;
```

Behavior contract:

- Returns the current snapshot for a registered topic.
- The initial value is the handler's initial `state`.
- The snapshot remains readable after `dispose()`.
- Unknown keys are rejected by TypeScript when using a finite schema. Runtime
  unknown-key reads are not guaranteed.

Example:

```ts
const messages = store.getState("chat");
```

### subscribe

Signature:

```ts
store.subscribe<K extends TopicKey<Schema>>(
  key: K,
  listener: (state: TopicState<Schema, K>) => void
): Unsubscribe;
```

Behavior contract:

- Registers a listener for successful updates to one topic.
- The listener receives the next topic state after the handler returns.
- The returned unsubscribe function is idempotent.
- Unsubscribing stops future notifications for that listener but does not stop
  the topic state from updating.
- Duplicate subscriptions are independent.
- Notification uses a stable listener snapshot, so unsubscribing another
  listener during notification does not skip it for the current message.
- New subscriptions after `dispose()` throw `Error`.

Example:

```ts
const unsubscribe = store.subscribe("chat", (messages) => {
  console.log(messages.at(-1));
});

unsubscribe();
unsubscribe();
```

### subscribeRaw

Signature:

```ts
store.subscribeRaw(listener: RawMessageListener): Unsubscribe;
```

Behavior contract:

- Fires before protocol parsing.
- Receives `{ data, event }`, where `data` is the original `MessageEvent.data`.
- The returned unsubscribe function is idempotent.
- New raw subscriptions after `dispose()` throw `Error`.

Example:

```ts
const stopRaw = store.subscribeRaw(({ data, event }) => {
  console.log(data, event.type);
});
```

### subscribeAll

Signature:

```ts
store.subscribeAll(listener: TopicUpdateListener<Schema>): Unsubscribe;
```

Behavior contract:

- Fires after any successful registered topic update.
- Receives `{ key, data, state }` for the updated topic.
- Does not fire for ignored, malformed, unhandled, unknown-topic, or failed
  handler messages.
- The returned unsubscribe function is idempotent.
- New all-topic subscriptions after `dispose()` throw `Error`.

Example:

```ts
const stopAll = store.subscribeAll((update) => {
  console.log(update.key, update.state);
});
```

### subscribeUnhandled

Signature:

```ts
store.subscribeUnhandled(listener: UnhandledMessageListener): Unsubscribe;
```

Behavior contract:

- Fires when a parsed default-protocol message has no registered handler.
- Fires when a custom parser returns `{ type: "unhandled", data, key? }`.
- Unknown default-protocol topics also report `ERR_UNKNOWN_TOPIC` through
  `onError`.
- Custom `unhandled` parser results do not report routing errors.
- The returned unsubscribe function is idempotent.
- New unhandled subscriptions after `dispose()` throw `Error`.

Example:

```ts
const stopUnhandled = store.subscribeUnhandled(({ key, data }) => {
  console.log(key, data);
});
```

### send

Signature:

```ts
store.send<K extends TopicKey<Schema>>({
  key,
  data,
}: {
  key: K;
  data: TopicPayload<Schema, K>;
}): void;
```

Behavior contract:

- Throws `SocketStoreError` with code `ERR_SOCKET_NOT_OPEN` before sending when
  `socket.readyState !== 1`.
- Uses the custom protocol serializer when provided.
- Otherwise sends `JSON.stringify({ key, data })`.
- Serializer or socket-send failures are reported through `onError` as
  `ERR_PROTOCOL_SERIALIZE_FAILED` and rethrown.
- Sending after `dispose()` throws `Error`.

Example:

```ts
store.send({
  key: "chat",
  data: { author: "Ada", text: "Hello" },
});
```

### dispose

Signature:

```ts
store.dispose(): void;
```

Behavior contract:

- Idempotently removes native socket listeners.
- Clears topic, raw, all-topic, and unhandled subscriptions.
- Prevents future `send` and subscription calls.
- Does not erase readable topic snapshots.

Example:

```ts
store.dispose();
store.dispose();
```

## Default Protocol

Incoming default-protocol messages must be string JSON envelopes:

```ts
type SocketStoreEnvelope = {
  key: string;
  data: unknown;
};
```

Behavior contract:

- `key` selects a registered handler.
- `data` is passed to the handler callback.
- Non-string message data reports `ERR_UNSUPPORTED_MESSAGE_DATA`.
- Invalid JSON reports `ERR_INVALID_JSON`.
- JSON values without a string `key` report `ERR_MALFORMED_ENVELOPE`.
- The exported `SocketStoreEnvelope` type models `data` as present, but runtime
  handling for envelopes that omit `data` is undecided and should not be relied
  on.
- Unknown topic keys notify unhandled subscribers, report `ERR_UNKNOWN_TOPIC`,
  and do not update topic state.

Example:

```ts
socket.dispatchEvent(
  new MessageEvent("message", {
    data: JSON.stringify({
      key: "chat",
      data: { author: "Ada", text: "Hello" },
    }),
  })
);
```

## Custom Protocols

Import path:

```ts
import type { SocketStoreProtocol } from "socket-store";
```

Signature:

```ts
type SocketStoreProtocol<Schema> = {
  parse?: (event: MessageEvent) => SocketStoreProtocolResult;
  serialize?: (message: SocketStoreOutgoingMessage<Schema>) => SocketStoreSendData;
};
```

Parser result contract:

```ts
type SocketStoreProtocolResult =
  | { type: "topic"; key: string; data: unknown }
  | { type: "unhandled"; key?: string; data: unknown }
  | { type: "ignore" };
```

Behavior contract:

- `parse` receives the original `MessageEvent`.
- Parser and serializer methods are called with the protocol object as `this`.
- Custom parsers may map non-string message data, such as `ArrayBuffer`.
- `topic` results route through handlers.
- `ignore` results do not update state and do not report errors.
- `unhandled` results notify unhandled subscribers and do not report routing
  errors.
- Parser throws are reported as `ERR_PROTOCOL_PARSE_FAILED`.
- Invalid parser results are reported as `ERR_INVALID_PROTOCOL_RESULT`.

Example:

```ts
const protocol: SocketStoreProtocol<AppSchema> = {
  parse(event) {
    const message = JSON.parse(event.data as string);

    if (message.type === "heartbeat") {
      return { type: "ignore" };
    }

    return {
      type: "topic",
      key: message.topic,
      data: message.payload,
    };
  },
  serialize({ key, data }) {
    return JSON.stringify({ topic: key, payload: data });
  },
};
```

## Lifecycle And Errors

Options signature:

```ts
type ISocketStoreOptions<Schema> = {
  onConnect?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: SocketStoreError) => void;
  protocol?: SocketStoreProtocol<Schema>;
};
```

Behavior contract:

- `onConnect` runs for native `open` events before disposal.
- `onClose` receives native `CloseEvent` values before disposal.
- Native socket `error` events are wrapped as `SocketStoreError` with code
  `ERR_SOCKET_ERROR`.
- Incoming parse, validation, route, and handler failures are reported through
  `onError` and do not update topic state.
- If `onError` is not provided, asynchronous message and socket error events do
  not throw to the caller.

`SocketStoreError` signature:

```ts
class SocketStoreError extends Error {
  name: "SocketStoreError";
  code: SocketStoreErrorCode;
  context: SocketStoreErrorContext;
}
```

Error codes:

- `ERR_SOCKET_ERROR`
- `ERR_UNSUPPORTED_MESSAGE_DATA`
- `ERR_INVALID_JSON`
- `ERR_MALFORMED_ENVELOPE`
- `ERR_INVALID_PROTOCOL_RESULT`
- `ERR_PROTOCOL_PARSE_FAILED`
- `ERR_PROTOCOL_SERIALIZE_FAILED`
- `ERR_UNKNOWN_TOPIC`
- `ERR_HANDLER_FAILED`
- `ERR_SOCKET_NOT_OPEN`

Example:

```ts
const store = new SocketStore(socket, [chatHandler], {
  onError(error) {
    console.error(error.code, error.context.phase);
  },
});
```

## Non-Goals And Undecided Behavior

`socket-store` does not guarantee or provide:

- Reconnection, backoff, or offline send queues.
- React hooks or render behavior.
- Persistence.
- RPC, CRDT, or collaborative editing semantics.
- Byte-level stream parsing across multiple WebSocket messages.
- A2A protocol support.
- MCP docs-query integration.

Undecided behavior:

- Runtime `getState` for unknown keys is not a supported contract.
- Runtime handling for default envelopes that omit `data` is not a supported
  contract.
- Listener exception handling is not wrapped by `SocketStore`; do not rely on
  listener failures being converted to `SocketStoreError`.
- The package accepts any `WebSocket`-compatible object at runtime, but the
  public contract is the standard `WebSocket` interface.
