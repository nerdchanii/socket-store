import { MessageHandler } from "./createMessageHandler";
import {
  DefaultSchema,
  ISocketStore,
  ISocketStoreOptions,
  SocketSchema,
  SocketStoreMessageHandlers,
  Store,
  TopicKey,
  TopicPayload,
  TopicState,
  Unsubscribe,
} from "./types";

type StoreListener = {
  key: string;
  listener: (state: any) => void;
};

export class SocketStore<Schema extends SocketSchema = DefaultSchema>
  implements ISocketStore<Schema>
{
  store = {} as Store;
  listeners: StoreListener[];
  options = {} as ISocketStoreOptions;
  constructor(
    protected socket: WebSocket,
    messageHandlers: SocketStoreMessageHandlers<Schema>,
    options?: ISocketStoreOptions
  ) {
    this.options = options || {};
    this.listeners = [];
    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("error", this.onError.bind(this));
    this.socket.addEventListener("close", this.onClose.bind(this));

    const handlers = messageHandlers as Array<MessageHandler<any, any>>;
    this.store = handlers.reduce((acc, cur) => {
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

  send = <K extends TopicKey<Schema>>({ key, data }: { key: K; data: TopicPayload<Schema, K> }) => {
    this.socket.send(JSON.stringify({ key, data }));
  };

  private setData = ({ key, state }: { key: string; state: any }) => {
    const newState = this.store[key].callback(this.store[key].state, state);
    this.store[key].state = newState;
  };

  getState = <K extends TopicKey<Schema>>(key: K): TopicState<Schema, K> => {
    return this.store[key as string].state;
  };

  subscribe = <K extends TopicKey<Schema>>(
    key: K,
    listener: (state: TopicState<Schema, K>) => void
  ): Unsubscribe => {
    const entry = { key, listener };
    this.listeners.push(entry);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.listeners = this.listeners.filter((current) => current !== entry);
    };
  };

  private notify = (key: string) => {
    const snapshot = [...this.listeners];
    snapshot.forEach((listener) => {
      if (listener.key === key) {
        listener.listener(this.getState(key as TopicKey<Schema>));
      }
    });
  };
}
