import {createMessageHandler, SocketStore} from "socket-store";


const chat = createMessageHandler<string[], string>(
  "talk",
  (state, data) => {
    return [...state, data];
  },
  []
);

const socketStore = new SocketStore(
  new WebSocket("ws://localhost:3000"),
  [chat],
  {
    onConnect: () => {
      console.log("connected");
    },
    onClose: (event) => {
      console.log("closed");
    },
  }
);

export default socketStore;