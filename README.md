
# Socket-Store

It is Websocket Store

## How to use

### 1. Install
```
# npm 
npm install socket-store

# yarn

yarn add socket-store
```


### 2. Create MessageHandler and SocketStore

#### 2-1. Create MessageHandler
<br>

First, create a message handler. <br> Define the topic, callback for the topic, and default status. This will be provided in the store.<br>

- createMessageHandler(key, callback, state)
  - key : it will be subject of message.
  - callback: it will works like reducer. it **_must return state!_**
  - state: it is defualt state.

```ts
const talkHandler = createMessageHandler<string[], string>(
  "talk",
  (state, data) => {
    return [...state, data];
  },
  []
);
```



#### 2-2. Create SocketStore

Next, create a socket store.
Store gets two parameters for web sockets and message handlers.

```ts
//handlers = you can uses like this.
const talkHandler = createMessageHandler('talk', (state, data)=>[...state, data], []);
const tradingHandler = createMessageHandler('trade', (state,data)=>data, null);

const socket = new WebSocket("ws://localhost:3030");
const store = new SocketStore(socket, [talkHandler, tradingHandler]);
```



#### 2-3. How to send and How to get state

```ts
// key is messagehandlers key, data: any type
store.send({key: 'talk', data: {user:'nerd', message:'hello'});

// give to key of messageHandler, then receive state about key.
store.getState('talk'); 
// return state of 'talk' topic
// ex) [{user:'nerd',message:'hi'}, {user:'chanii',message:'Can you help me? '}, {user: 'nerd', message:'kk'}] 

```

### 2-4. Observe incoming messages

SocketStore also exposes observable paths for incoming messages around the
default JSON `{ key, data }` protocol.

```ts
// Fires before SocketStore parses the WebSocket message data.
const unsubscribeRaw = store.subscribeRaw(({ data, event }) => {
  console.log(data, event);
});

// Fires after any registered topic updates its state.
const unsubscribeAll = store.subscribeAll(({ key, data, state }) => {
  console.log(key, data, state);
});

// Fires when a parsed message has a key with no registered handler.
// Unknown topics are still reported through options.onError.
const unsubscribeUnhandled = store.subscribeUnhandled(({ key, data }) => {
  console.log(key, data);
});

unsubscribeRaw();
unsubscribeAll();
unsubscribeUnhandled();
```

### 2-5. Adapt a custom message protocol

By default, incoming WebSocket messages must be JSON strings shaped as
`{ key, data }`, and `store.send` writes the same envelope. If your server uses
different field names or binary data, pass a synchronous protocol adapter.

```ts
const store = new SocketStore(socket, [talkHandler], {
  protocol: {
    parse(event) {
      const message = JSON.parse(event.data);

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

The parser receives the original `MessageEvent`, so adapters can handle
`string`, `ArrayBuffer`, `Blob`, or runtime-specific `event.data` values. Parser
failures are reported to `onError` as `SocketStoreError` values. SocketStore is
not a byte-level streaming parser; decode complete WebSocket messages in your
adapter and return `topic`, `unhandled`, or `ignore`.


## LICENSE

MIT


