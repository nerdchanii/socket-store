import { MessageHandler } from "./createMessageHandler";
import {
  DefaultSchema,
  ISocketStore,
  ISocketStoreOptions,
  SocketSchema,
  SocketStoreError,
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
  constructor(
    protected socket: WebSocket,
    messageHandlers: SocketStoreMessageHandlers<Schema>,
    options?: ISocketStoreOptions
  ) {
    this.options = options || {};
    this.listeners = [];

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

    this.socket.addEventListener("open", this.onConnect.bind(this));
    this.socket.addEventListener("message", this.onMessage.bind(this));
    this.socket.addEventListener("error", this.onError.bind(this));
    this.socket.addEventListener("close", this.onClose.bind(this));
  }

  onConnect() {
    if (this.options.onConnect) {
      this.options.onConnect();
    }
  }

  onMessage({ data }: MessageEvent<string>) {
    if (typeof data !== "string") {
      this.emitError(
        new SocketStoreError(
          "ERR_UNSUPPORTED_MESSAGE_DATA",
          "socket-store default protocol only supports string message data",
          { phase: "parse", data }
        )
      );
      return;
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      this.emitError(
        new SocketStoreError("ERR_INVALID_JSON", "Invalid JSON message", {
          phase: "parse",
          data,
          cause: error,
        })
      );
      return;
    }

    if (!this.isEnvelope(payload)) {
      this.emitError(
        new SocketStoreError(
          "ERR_MALFORMED_ENVELOPE",
          "SocketStore message must be a JSON object with a string key",
          { phase: "validate", data: payload }
        )
      );
      return;
    }

    if (!this.hasHandler(payload.key)) {
      this.emitError(
        new SocketStoreError(
          "ERR_UNKNOWN_TOPIC",
          `No socket-store handler registered for topic: ${payload.key}`,
          { phase: "route", key: payload.key, data: payload }
        )
      );
      return;
    }

    try {
      this.setData({ key: payload.key, state: payload.data });
    } catch (error) {
      this.emitError(
        new SocketStoreError(
          "ERR_HANDLER_FAILED",
          `SocketStore handler failed for topic: ${payload.key}`,
          {
            phase: "handle",
            key: payload.key,
            data: payload,
            cause: error,
          }
        )
      );
      return;
    }

    this.notify(payload.key);
  }

  onClose = (event: CloseEvent) => {
    this.options.onClose?.(event);
  };

  onError = (event: Event) => {
    this.emitError(
      new SocketStoreError("ERR_SOCKET_ERROR", "WebSocket error", {
        phase: "socket",
        event,
      })
    );
  };

  send = <K extends TopicKey<Schema>>({ key, data }: { key: K; data: TopicPayload<Schema, K> }) => {
    if (this.socket.readyState !== OPEN_READY_STATE) {
      throw new SocketStoreError(
        "ERR_SOCKET_NOT_OPEN",
        "Cannot send because the WebSocket is not open",
        { phase: "send", key, data }
      );
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

  private isEnvelope(value: unknown): value is SocketStoreEnvelope {
    if (value === null || typeof value !== "object") {
      return false;
    }

    return typeof (value as { key?: unknown }).key === "string";
  }

  private emitError(error: SocketStoreError) {
    if (this.options.onError) {
      this.options.onError(error);
      return;
    }

    throw error;
  }
}
