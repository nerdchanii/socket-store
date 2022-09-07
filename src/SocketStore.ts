import { MessageHandler } from "./createMessageHandler";
import { ISocketStore, ISocketStoreOptions, Store } from "./types";

export class SocketStore implements ISocketStore {
  store = {} as Store;
  listeners: any[];
  options = {} as ISocketStoreOptions;
  constructor(
    protected socket: WebSocket,
    messageHandlers: Array<MessageHandler<any, any>>,
    options?: ISocketStoreOptions
  ) {
    this.options = options || {};
    this.listeners = [];
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("error", this.onError.bind(this));
    this.socket.addEventListener("close", this.onClose.bind(this));

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
    if (this.options.onConnect) {
      this.options.onConnect();
    }
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
    this.options.onClose?.(event);
  };

  onError = (event: Event) => {
    this.options.onError?.(event);
  };

  send = ({ key, data }: { key: string; data: any }) => {
    this.socket.send(JSON.stringify({ key, data }));
  };

  private setData = ({ key, state }: { key: string; state: any }) => {
    const newState = this.store[key].callback(this.store[key].state, state);
    this.store[key].state = newState;
  };

  getState = (key: string) => {
    return this.store[key].state;
  };

  subscribe = (key: string, listener: (state: any) => void) => {
    this.listeners.push({ key, listener });
  };

  private notify = (key: string) => {
    this.listeners.forEach((listener) => {
      if (listener.key === key) {
        listener.listener(this.getState(key));
      }
    });
  };
}
