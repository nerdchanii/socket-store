# Socket-Store

it is websocket Store

## How to use

### 1. install
```
# npm 
npm install socket-store

# yarn

yarn add socket-store
```


#### 2. create Message Handler

<br>

First, create a message handler. <br> Define the topic, callback for the topic, and default status. This will be provided in the store.<br>

- createMessageHandler(key, callback, state)<br>
  - key : it will be subject of message.
  - callback: it will works like reducer. it **_must return state!_**
  - state: it is defualt state.
    <br>

```ts
const talkHandler = createMessageHandler<string[], string>(
  "talk",
  (state, data) => {
    return [...state, data];
  },
  []
);
```

#### 2-2 create SocketStore(socket: Websocket, messageHandlers)

<br>

Next, create a socket store.<br>
Store gets two parameters for web sockets and message handlers.

```ts
//handlers = you can uses like this.
const talkHandler = createMessageHandler(key, callback, []);
const tradingHandler = createMessageHandler(key, callback, null);

const socket = new WebSocket("ws://localhost:3030");
const store = new SocketStore(socket, [talkHandler, tradingHandler]);
```

<br>
<br>

#### 2-3 how to send and how to get state

```ts
// key is messagehandlers key, data: any type
store.send({key: 'talk', data: "What a simple!"});

// give to key of messageHandler, then receive state about key.
store.getState('talk');
```
<hr />




