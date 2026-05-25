import { MessageHandler } from "./createMessageHandler";
import {
  DefaultSchema,
  ISocketStore,
  ISocketStoreOptions,
  SocketSchema,
  SocketStoreEnvelope,
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

const OPEN_READY_STATE = 1;

export class SocketStore<Schema extends SocketSchema = DefaultSchema>
  implements ISocketStore<Schema>
{
  store = {} as Store;
  listeners: StoreListener[];
  options = {} as ISocketStoreOptions;
  private disposed = false;
  private readonly handleOpen = () => this.onConnect();
  private readonly handleMessage = (event: MessageEvent<string>) =>
    this.onMessage(event);
  private readonly handleError = (event: Event) => this.onError(event);
  private readonly handleClose = (event: CloseEvent) => this.onClose(event);

  constructor(
    protected socket: WebSocket,
    messageHandlers: SocketStoreMessageHandlers<Schema>,
    options?: ISocketStoreOptions
  ) {
    this.options = options || {};
    this.listeners = [];
    this.socket.addEventListener("open", this.handleOpen);
    this.socket.addEventListener("message", this.handleMessage);
    this.socket.addEventListener("error", this.handleError);
    this.socket.addEventListener("close", this.handleClose);

    const handlers = messageHandlers as Array<MessageHandler<any, any>>;
    this.store = handlers.reduce((acc, cur) => {
      if (Object.prototype.hasOwnProperty.call(acc, cur.key)) {
        throw new Error(`Duplicate socket-store handler key: ${cur.key}`);
      }

      const temp = {
        state: cur.state,
        callback: cur.callback,
      };
      acc[cur.key] = temp;
      return acc;
    }, Object.create(null) as Store);
  }

  onConnect() {
    if (this.disposed) {
      return;
    }

    if (this.options.onConnect) {
      this.options.onConnect();
    }
  }

  onMessage({ data }: MessageEvent<string>) {
    if (this.disposed) {
      return;
    }

    if (typeof data !== "string") {
      this.reportMessageError(
        new Error("socket-store only supports string messages"),
        "non-string-message",
        data
      );
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      this.reportMessageError(
        error instanceof Error ? error : new Error(String(error)),
        "invalid-json",
        data
      );
      return;
    }

    if (!this.isEnvelope(payload)) {
      this.reportMessageError(
        new Error("SocketStore message must be a JSON object with a string key"),
        "malformed-envelope",
        payload
      );
      return;
    }

    if (!this.hasHandler(payload.key)) {
      this.options.onUnknownMessage?.(payload);
      return;
    }

    try {
      this.setData({ key: payload.key, state: payload.data });
    } catch (error) {
      this.reportMessageError(
        error instanceof Error ? error : new Error(String(error)),
        "handler-error",
        payload
      );
      return;
    }

    this.notify(payload.key);
  }

  onClose = (event: CloseEvent) => {
    if (this.disposed) {
      return;
    }

    this.options.onClose?.(event);
  };

  onError = (event: Event) => {
    if (this.disposed) {
      return;
    }

    this.options.onError?.(event);
  };

  send = <K extends TopicKey<Schema>>({ key, data }: { key: K; data: TopicPayload<Schema, K> }) => {
    this.assertActive("send");

    if (this.socket.readyState !== OPEN_READY_STATE) {
      throw new Error("Cannot send because the WebSocket is not open");
    }

    this.socket.send(JSON.stringify({ key, data }));
  };

  private setData = ({ key, state }: { key: string; state: any }) => {
    const newState = this.store[key].callback(this.store[key].state, state);
    this.store[key].state = newState;
  };

  private hasHandler(key: string) {
    return Object.prototype.hasOwnProperty.call(this.store, key);
  }

  getState = <K extends TopicKey<Schema>>(key: K): TopicState<Schema, K> => {
    return this.store[key as string].state;
  };

  subscribe = <K extends TopicKey<Schema>>(
    key: K,
    listener: (state: TopicState<Schema, K>) => void
  ): Unsubscribe => {
    this.assertActive("subscribe");

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

  dispose = () => {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.listeners = [];
    this.socket.removeEventListener("open", this.handleOpen);
    this.socket.removeEventListener("message", this.handleMessage);
    this.socket.removeEventListener("error", this.handleError);
    this.socket.removeEventListener("close", this.handleClose);
  };

  private assertActive(action: "send" | "subscribe") {
    if (this.disposed) {
      throw new Error(`Cannot ${action} after SocketStore has been disposed`);
    }
  }

  private isEnvelope(value: unknown): value is SocketStoreEnvelope {
    if (value === null || typeof value !== "object") {
      return false;
    }

    return typeof (value as { key?: unknown }).key === "string";
  }

  private reportMessageError(
    error: Error,
    reason: Parameters<NonNullable<ISocketStoreOptions["onMessageError"]>>[1]["reason"],
    data: unknown
  ) {
    this.options.onMessageError?.(error, { reason, data });
  }
}
