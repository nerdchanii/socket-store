# socket-store

`socket-store` helps you turn WebSocket topic messages into local snapshots you
can read, subscribe to, and send back with a consistent API.

Use it when your server sends messages such as chat updates, prices, presence,
or notifications and you want one handler per topic instead of parsing each
message in UI code.

## Install

```sh
npm install socket-store
```

## Getting Started

Create a WebSocket, define one handler per topic, then subscribe to the
snapshots you care about:

```ts
import { SocketStore, createMessageHandler } from "socket-store";

type ChatMessage = {
  author: string;
  text: string;
};

type AppSchema = {
  chat: { state: ChatMessage[]; payload: ChatMessage };
};

const chatHandler = createMessageHandler<ChatMessage[], ChatMessage, "chat">(
  "chat",
  (messages, incoming) => [...messages, incoming],
  []
);

const socket = new WebSocket("wss://example.com/realtime");
const store = new SocketStore<AppSchema>(socket, [chatHandler]);

const stopMessages = store.subscribe("chat", (messages) => {
  console.log(messages.at(-1));
});

socket.addEventListener("open", () => {
  store.send({
    key: "chat",
    data: { author: "Ada", text: "Hello" },
  });
});
```

The default protocol expects JSON messages shaped like:

```json
{ "key": "chat", "data": { "author": "Ada", "text": "Hello" } }
```

## Cleanup

Call `dispose()` when the store should stop listening to socket events, and
call each unsubscribe function when a listener is no longer needed:

```ts no-verify
stopMessages();
store.dispose();
```

## Where To Go Next

- [API Reference](/api): constructor options, subscriptions, errors, and type
  contracts.
- [Connection Status](/connection-status): `getStatus()`,
  `subscribeStatus(listener)`, and status transitions.
- [Reconnect Configuration](/reconnect): what reconnect behavior the package
  does and does not own.
- [Runnable Example](/example): a local server and browser client you can run
  from a clean checkout.
- [README](https://github.com/nerdchanii/socket-store#readme): package overview
  on GitHub and npm.
