# socket-store

`socket-store` is a small WebSocket-first topic state store. It listens to
WebSocket messages, routes each message by topic, and lets a topic handler turn
the incoming payload into the next local snapshot.

It is useful when a server sends topic updates such as chat messages, prices,
presence, or notifications and the client wants a typed snapshot API around
those updates.

## Install

```sh
npm install socket-store
```

```sh
yarn add socket-store
```

## Core Model

A `SocketStore` has three parts:

1. A WebSocket instance.
2. One handler per topic.
3. Optional lifecycle, error, and protocol options.

Each handler owns the state for one topic. The handler callback receives the
current state and the incoming payload, then returns the next state. Handlers can
accumulate messages, replace a snapshot, or ignore a payload by returning the
current state.

```ts
import { SocketStore, createMessageHandler } from "socket-store";

type ChatMessage = {
  author: string;
  text: string;
};

type PriceTick = {
  symbol: string;
  value: number;
};

type AppSchema = {
  chat: { state: ChatMessage[]; payload: ChatMessage };
  price: { state: PriceTick | null; payload: PriceTick };
};

const chatHandler = createMessageHandler<ChatMessage[], ChatMessage, "chat">(
  "chat",
  (state, payload) => [...state, payload],
  []
);

const priceHandler = createMessageHandler<PriceTick | null, PriceTick, "price">(
  "price",
  (_state, payload) => payload,
  null
);

const socket = new WebSocket("wss://example.com/realtime");
const store = new SocketStore<AppSchema>(socket, [chatHandler, priceHandler]);

store.subscribe("chat", (messages) => {
  console.log(messages.at(-1));
});

store.send({
  key: "chat",
  data: { author: "Ada", text: "Hello" },
});
```

Schema-based usage ties topic keys, incoming payloads, stored state, `send`,
`subscribe`, and `getState` together. If you do not provide a schema, the
package still supports loose topic names and `any` payloads for older usage.

## Default Protocol

By default, incoming WebSocket messages must be JSON strings shaped as:

```json
{ "key": "chat", "data": { "author": "Ada", "text": "Hello" } }
```

The `key` field selects the topic handler. The `data` field is passed to that
handler as its payload. `store.send({ key, data })` serializes the same envelope
back to the socket.

Both `ws://` and `wss://` URLs work because `socket-store` accepts a standard
`WebSocket` instance:

```ts no-verify
new SocketStore(new WebSocket("ws://localhost:3030"), handlers);
new SocketStore(new WebSocket("wss://example.com/realtime"), handlers);
```

## Reading Snapshots

`getState` returns the current snapshot for a topic:

```ts no-verify
const messages = store.getState("chat");
```

`subscribe` registers a listener for future updates and returns an idempotent
unsubscribe function:

```ts no-verify
const unsubscribe = store.subscribe("price", (price) => {
  console.log(price);
});

unsubscribe();
unsubscribe();
```

Topic listeners are called after the handler returns the next state. Calling the
unsubscribe function stops future notifications for that listener. It does not
remove the topic handler and it does not stop the store from updating that topic.

## Observing Incoming Messages

Use these subscriptions when you need visibility around the default protocol:

```ts no-verify
const stopRaw = store.subscribeRaw(({ data, event }) => {
  console.log("raw message", data, event);
});

const stopAll = store.subscribeAll(({ key, data, state }) => {
  console.log("topic updated", key, data, state);
});

const stopUnhandled = store.subscribeUnhandled(({ key, data }) => {
  console.log("unhandled topic", key, data);
});

stopRaw();
stopAll();
stopUnhandled();
```

`subscribeRaw` fires before parsing. `subscribeAll` fires after any registered
topic updates. `subscribeUnhandled` fires when a parsed message has no matching
registered handler or when a custom protocol returns an unhandled result.

## Lifecycle And Errors

Pass lifecycle callbacks through the third constructor argument:

```ts no-verify
import { SocketStoreError } from "socket-store";

const store = new SocketStore(socket, handlers, {
  onConnect() {
    console.log("connected");
  },
  onClose(event) {
    console.log("closed", event.code);
  },
  onError(error: SocketStoreError) {
    console.error(error.code, error.message, error.context);
  },
});
```

`SocketStoreError` reports protocol, routing, handler, socket, and send failures.
The current error codes are:

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

`send` throws `ERR_SOCKET_NOT_OPEN` if the WebSocket is not open. Serializer
failures are reported to `onError` and rethrown. Incoming parse, route, and
handler failures are reported to `onError` and do not update topic state.

Call `dispose()` when the store should stop owning the socket listeners:

```ts no-verify
store.dispose();
```

Disposal removes WebSocket event listeners and clears store subscriptions.
Calling `send` or adding a new subscription after disposal throws.

## Custom Protocols

Use a protocol adapter when your server does not send the default `{ key, data }`
JSON envelope.

```ts no-verify
const store = new SocketStore(socket, handlers, {
  protocol: {
    parse(event) {
      const message = JSON.parse(event.data as string);

      if (message.type === "heartbeat") {
        return { type: "ignore" };
      }

      if (!message.topic) {
        return { type: "unhandled", data: message };
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
  },
});
```

The parser receives the original `MessageEvent`, so adapters can decode
`string`, `ArrayBuffer`, `Blob`, or runtime-specific `event.data` values.
Adapters must return `topic`, `unhandled`, or `ignore`.

`socket-store` is not a byte-level stream parser. Decode complete WebSocket
messages in the adapter.

## Runnable Example

This repository includes a minimal WebSocket server and browser client that use
the default envelope protocol and schema-based types.

Run the server:

```sh
npm run example:server
```

In another terminal, run the browser client:

```sh
npm run example:client
```

Open the Vite URL and send a message. The server echoes the `{ key: "talk",
data }` envelope back to the browser, and the `talk` topic snapshot updates on
screen.

The example is type-checked by CI:

```sh
npm run example:typecheck
```

## socket-store And react-socket-store

`socket-store` is the framework-agnostic core. It owns WebSocket message routing,
topic snapshots, subscriptions, protocol adapters, and error reporting.

`react-socket-store` is a React adapter package. React-specific hook behavior,
render timing, and React Server Component boundaries belong there, not in this
core package.

## Migration Notes

Older `socket-store` code can keep using untyped handlers:

```ts no-verify
const handler = createMessageHandler("talk", (state, data) => [...state, data], []);
const store = new SocketStore(socket, [handler]);
```

For new code, prefer a schema and explicit handler generics so TypeScript can
match each topic key to the correct state and payload.

The stabilized default protocol expects a JSON object with a string `key`. If an
older server sends a different shape, keep the server unchanged and adapt it
with `options.protocol.parse` and `options.protocol.serialize`.

Subscriptions now return unsubscribe functions. Keep those functions and call
them when a view, component, or feature no longer needs updates.

Use `dispose()` when the entire store instance is no longer needed.

## Non-Goals

`socket-store` does not try to be:

- A WebRTC framework.
- A CRDT or collaborative editing engine.
- An RPC framework.
- A byte-level streaming parser.
- A persistence layer.
- A React hook package.

Those concerns can be built around `socket-store`, but they are outside the core
package contract.

## License

MIT
