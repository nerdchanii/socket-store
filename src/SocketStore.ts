import { MessageHandler } from "./createMessageHandler";
import {
  DefaultSchema,
  ISocketStore,
  ISocketStoreOptions,
  RawMessageListener,
  RawSocketStoreMessage,
  SocketSchema,
  SocketStoreError,
  SocketStoreConnectionStatus,
  SocketStoreStatusListener,
  SocketStoreEnvelope,
  SocketStoreMessageHandlers,
  SocketStoreOutgoingMessage,
  SocketStoreProtocolResult,
  SocketStoreSendData,
  Store,
  TopicKey,
  TopicPayload,
  TopicState,
  TopicUpdate,
  TopicUpdateListener,
  UnhandledSocketStoreMessage,
  UnhandledMessageListener,
  Unsubscribe,
} from "./types";

type StoreListener = {
  key: string;
  listener: (state: any) => void;
};

type ListenerEntry<Listener> = {
  listener: Listener;
};

const OPEN_READY_STATE = 1;

export class SocketStore<Schema extends SocketSchema = DefaultSchema>
  implements ISocketStore<Schema>
{
  store = {} as Store;
  listeners: StoreListener[];
  private rawListeners: Array<ListenerEntry<RawMessageListener>>;
  private allTopicListeners: Array<ListenerEntry<TopicUpdateListener<Schema>>>;
  private unhandledListeners: Array<ListenerEntry<UnhandledMessageListener>>;
  private statusListeners: Array<ListenerEntry<SocketStoreStatusListener>>;
  private status: SocketStoreConnectionStatus;
  options = {} as ISocketStoreOptions<Schema>;
  private disposed = false;
  private readonly originalClose: WebSocket["close"];
  private readonly handleOpen = () => this.onConnect();
  private readonly handleMessage = (event: MessageEvent) =>
    this.onMessage(event);
  private readonly handleError = (event: Event) => this.onError(event);
  private readonly handleClose = (event: CloseEvent) => this.onClose(event);
  private readonly handleCloseRequest = (code?: number, reason?: string) => {
    this.setStatus("closing");
    this.originalClose.call(this.socket, code, reason);
  };

  constructor(
    protected socket: WebSocket,
    messageHandlers: SocketStoreMessageHandlers<Schema>,
    options?: ISocketStoreOptions<Schema>
  ) {
    this.options = options || {};
    this.listeners = [];
    this.rawListeners = [];
    this.allTopicListeners = [];
    this.unhandledListeners = [];
    this.statusListeners = [];
    this.status = this.getInitialStatus();
    this.originalClose = this.socket.close;

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

    this.socket.addEventListener("open", this.handleOpen);
    this.socket.addEventListener("message", this.handleMessage);
    this.socket.addEventListener("error", this.handleError);
    this.socket.addEventListener("close", this.handleClose);
    this.socket.close = this.handleCloseRequest;
  }

  onConnect() {
    if (this.disposed) {
      return;
    }

    this.setStatus("open");

    if (this.options.onConnect) {
      this.options.onConnect();
    }
  }

  onMessage(event: MessageEvent) {
    if (this.disposed) {
      return;
    }

    const { data } = event;
    this.notifyRaw({ data, event });

    if (this.disposed) {
      return;
    }

    const parsed = this.parseMessage(event);

    if (parsed === undefined || this.disposed || parsed.type === "ignore") {
      return;
    }

    if (parsed.type === "unhandled") {
      this.notifyUnhandled({ key: parsed.key, data: parsed.data });
      return;
    }

    const payload = { key: parsed.key, data: parsed.data };

    if (!this.hasHandler(payload.key)) {
      this.notifyUnhandled(payload);
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

    const state = this.getState(payload.key as TopicKey<Schema>);
    this.notify(payload.key);
    this.notifyAllTopics({
      key: payload.key,
      data: payload.data,
      state,
    } as TopicUpdate<Schema>);
  }

  onClose = (event: CloseEvent) => {
    if (this.disposed) {
      return;
    }

    this.setStatus("closed");
    this.options.onClose?.(event);
  };

  onError = (event: Event) => {
    if (this.disposed) {
      return;
    }

    this.emitError(
      new SocketStoreError("ERR_SOCKET_ERROR", "WebSocket error", {
        phase: "socket",
        event,
      })
    );
  };

  send = <K extends TopicKey<Schema>>({ key, data }: { key: K; data: TopicPayload<Schema, K> }) => {
    this.assertActive("send");

    if (this.socket.readyState !== OPEN_READY_STATE) {
      throw new SocketStoreError(
        "ERR_SOCKET_NOT_OPEN",
        "Cannot send because the WebSocket is not open",
        { phase: "send", key, data }
      );
    }

    try {
      const serialized = this.serializeMessage({ key, data });
      this.socket.send(serialized);
    } catch (error) {
      const socketError =
        error instanceof SocketStoreError
          ? error
          : new SocketStoreError(
              "ERR_PROTOCOL_SERIALIZE_FAILED",
              `SocketStore protocol serializer failed for topic: ${key}`,
              { phase: "send", key, data, cause: error }
            );

      this.emitError(socketError);
      throw socketError;
    }
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

  getStatus = (): SocketStoreConnectionStatus => {
    return this.getCurrentStatus();
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

  subscribeStatus = (listener: SocketStoreStatusListener): Unsubscribe => {
    this.assertActive("subscribe");

    const entry = { listener };
    this.statusListeners.push(entry);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.statusListeners = this.statusListeners.filter((current) => current !== entry);
    };
  };

  subscribeRaw = (listener: RawMessageListener): Unsubscribe => {
    this.assertActive("subscribe");

    const entry = { listener };
    this.rawListeners.push(entry);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.rawListeners = this.rawListeners.filter((current) => current !== entry);
    };
  };

  subscribeAll = (listener: TopicUpdateListener<Schema>): Unsubscribe => {
    this.assertActive("subscribe");

    const entry = { listener };
    this.allTopicListeners.push(entry);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.allTopicListeners = this.allTopicListeners.filter((current) => current !== entry);
    };
  };

  subscribeUnhandled = (listener: UnhandledMessageListener): Unsubscribe => {
    this.assertActive("subscribe");

    const entry = { listener };
    this.unhandledListeners.push(entry);

    let subscribed = true;
    return () => {
      if (!subscribed) {
        return;
      }

      subscribed = false;
      this.unhandledListeners = this.unhandledListeners.filter((current) => current !== entry);
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

  private notifyRaw = (message: RawSocketStoreMessage) => {
    const snapshot = [...this.rawListeners];
    snapshot.forEach(({ listener }) => {
      listener(message);
    });
  };

  private notifyAllTopics = (update: TopicUpdate<Schema>) => {
    const snapshot = [...this.allTopicListeners];
    snapshot.forEach(({ listener }) => {
      listener(update);
    });
  };

  private notifyUnhandled = (message: UnhandledSocketStoreMessage) => {
    const snapshot = [...this.unhandledListeners];
    snapshot.forEach(({ listener }) => {
      listener(message);
    });
  };

  private notifyStatus = () => {
    const snapshot = [...this.statusListeners];
    snapshot.forEach(({ listener }) => {
      listener(this.status);
    });
  };

  dispose = () => {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.listeners = [];
    this.rawListeners = [];
    this.allTopicListeners = [];
    this.unhandledListeners = [];
    this.statusListeners = [];
    this.socket.removeEventListener("open", this.handleOpen);
    this.socket.removeEventListener("message", this.handleMessage);
    this.socket.removeEventListener("error", this.handleError);
    this.socket.removeEventListener("close", this.handleClose);
    this.socket.close = this.originalClose;
  };

  private assertActive(action: "send" | "subscribe") {
    if (this.disposed) {
      throw new Error(`Cannot ${action} after SocketStore has been disposed`);
    }
  }

  private getInitialStatus(): SocketStoreConnectionStatus {
    return this.getStatusFromReadyState() ?? "connecting";
  }

  private getCurrentStatus(): SocketStoreConnectionStatus {
    return this.getStatusFromReadyState() ?? this.status;
  }

  private getStatusFromReadyState(): SocketStoreConnectionStatus | undefined {
    if (this.socket.readyState === 1) {
      return "open";
    }

    if (this.socket.readyState === 2) {
      return "closing";
    }

    if (this.socket.readyState === 3) {
      return "closed";
    }

    return undefined;
  }

  private setStatus(status: SocketStoreConnectionStatus) {
    if (this.status === status) {
      return;
    }

    this.status = status;
    this.notifyStatus();
  }

  private isEnvelope(value: unknown): value is SocketStoreEnvelope {
    if (value === null || typeof value !== "object") {
      return false;
    }

    return typeof (value as { key?: unknown }).key === "string";
  }

  private parseMessage(event: MessageEvent): SocketStoreProtocolResult | undefined {
    const protocol = this.options.protocol;

    let result: SocketStoreProtocolResult;
    try {
      result = protocol?.parse
        ? protocol.parse.call(protocol, event)
        : this.parseDefaultMessage(event);
    } catch (error) {
      const socketError =
        error instanceof SocketStoreError
          ? error
          : new SocketStoreError(
              "ERR_PROTOCOL_PARSE_FAILED",
              "SocketStore protocol parser failed",
              {
                phase: "parse",
                data: event.data,
                event,
                cause: error,
              }
            );

      this.emitError(socketError);
      return undefined;
    }

    if (!this.isProtocolResult(result)) {
      this.emitError(
        new SocketStoreError(
          "ERR_INVALID_PROTOCOL_RESULT",
          "SocketStore protocol parser must return a topic, unhandled, or ignore result",
          { phase: "validate", data: result }
        )
      );
      return undefined;
    }

    return result;
  }

  private parseDefaultMessage = (event: MessageEvent): SocketStoreProtocolResult => {
    const { data } = event;

    if (typeof data !== "string") {
      throw new SocketStoreError(
        "ERR_UNSUPPORTED_MESSAGE_DATA",
        "socket-store default protocol only supports string message data",
        { phase: "parse", data, event }
      );
    }

    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch (error) {
      throw new SocketStoreError("ERR_INVALID_JSON", "Invalid JSON message", {
        phase: "parse",
        data,
        event,
        cause: error,
      });
    }

    if (!this.isEnvelope(payload)) {
      throw new SocketStoreError(
        "ERR_MALFORMED_ENVELOPE",
        "SocketStore message must be a JSON object with a string key",
        { phase: "validate", data: payload, event }
      );
    }

    return { type: "topic", key: payload.key, data: payload.data };
  };

  private serializeMessage = <K extends TopicKey<Schema>>({
    key,
    data,
  }: {
    key: K;
    data: TopicPayload<Schema, K>;
  }): SocketStoreSendData => {
    const protocol = this.options.protocol;

    if (protocol?.serialize) {
      return protocol.serialize.call(
        protocol,
        { key, data } as SocketStoreOutgoingMessage<Schema>
      );
    }

    return JSON.stringify({ key, data });
  };

  private isProtocolResult(value: unknown): value is SocketStoreProtocolResult {
    if (value === null || typeof value !== "object") {
      return false;
    }

    const result = value as { type?: unknown; key?: unknown };

    if (result.type === "topic") {
      return typeof result.key === "string";
    }

    if (result.type === "unhandled") {
      return result.key === undefined || typeof result.key === "string";
    }

    return result.type === "ignore";
  }

  private emitError(error: SocketStoreError) {
    this.options.onError?.(error);
  }
}
