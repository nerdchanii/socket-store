[![Hits](https://hits.seeyoufarm.com/api/count/incr/badge.svg?url=https%3A%2F%2Fgithub.com%2Fnerdchanii%2Fsocket-store&count_bg=%236D9573&title_bg=%23FFF054&icon=javascript.svg&icon_color=%231E1E1D&title=hits&edge_flat=false)](https://hits.seeyoufarm.com)
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



## LICENSE

MIT




