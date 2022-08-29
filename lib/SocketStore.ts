import { MessageHandler } from "./createMessageHandler";
import { ISocketStore, Store } from "./types";

class SocketStore implements ISocketStore {
  store = {} as Store;
  listeners: any[];
  constructor(
    protected socket: WebSocket,
    messageHandlers: MessageHandler<any, any>[]
  ) {
    this.listeners = [];
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("close", this.onClose);

    this.store = messageHandlers.reduce((acc, cur) => {
      const temp = {
        state: cur.state,
        callback: cur.callback,
      };
      acc[cur.key] = temp;
      return acc;
    }, {} as Store);
  }

  onConnect() {
    console.log("socket connected");
  }

  onMessage({ data }: MessageEvent<string>) {
    if (typeof data === "string") {
      const payload = JSON.parse(data);
      this.setData({ key: payload.key, state: payload.data });
      this.notify(payload.key);
    } else {
      throw new Error(
        "data is not a string\n data: " + data + "\n typeof data " + typeof data
      );
    }
  }

  onClose = (event: CloseEvent) => {
    console.log("close", event.code, event.reason);
  };

  onError = (event: ErrorEvent) => {
    console.log("error", event);
  };

  send = ({ key, data }: { key: string; data: any }) => {
    this.socket.send(JSON.stringify({ key, data }));
  };

  setData = ({ key, state }: { key: string; state: any }) => {
    const newState = this.store[key].callback(this.store[key].state, state);
    this.store[key].state = newState;
  };

  getState = (key: string) => {
    return this.store[key].state;
  };

  subscribe = (key: string, listener: (state: any) => void) => {
    this.listeners.push({ key, listener });
  };

  notify = (key: string) => {
    this.listeners.forEach((listener) => {
      if (listener.key === key) {
        listener.listener(this.getState(key));
      }
    });
  };
}

export default SocketStore;
