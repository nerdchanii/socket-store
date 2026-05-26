import type { MessageHandler } from "./createMessageHandler";

// ===== Schema-based types =====

/**
 * Base constraint for a socket schema.
 * Each key is a topic name mapped to its state and payload types.
 *
 * @example
 * type AppSchema = {
 *   chat:  { state: Message[];    payload: Message    };
 *   price: { state: Price | null; payload: PriceTick  };
 * };
 */
export type SocketSchema = {
  [topic: string]: {
    state: unknown;
    payload: unknown;
  };
};

/** Union of all topic keys defined in a schema. */
export type TopicKey<Schema extends SocketSchema> = keyof Schema & string;

/** State type for a specific topic. */
export type TopicState<
  Schema extends SocketSchema,
  K extends TopicKey<Schema>
> = Schema[K]["state"];

/** Incoming payload type for a specific topic. */
export type TopicPayload<
  Schema extends SocketSchema,
  K extends TopicKey<Schema>
> = Schema[K]["payload"];

/**
 * Handler function type for a specific topic.
 * Receives the current state and an incoming payload and returns the next state.
 */
export type TopicHandler<
  Schema extends SocketSchema,
  K extends TopicKey<Schema>
> = (state: TopicState<Schema, K>, payload: TopicPayload<Schema, K>) => TopicState<Schema, K>;

/** MessageHandler union constrained to the state and payload of each schema topic. */
export type SchemaMessageHandler<Schema extends SocketSchema> = {
  [K in TopicKey<Schema>]: MessageHandler<
    TopicState<Schema, K>,
    TopicPayload<Schema, K>,
    K
  >;
}[TopicKey<Schema>];

/** Constructor handler list: loose by default, schema-constrained for finite schemas. */
export type SocketStoreMessageHandlers<Schema extends SocketSchema> =
  string extends TopicKey<Schema>
    ? Array<MessageHandler<any, any>>
    : Array<SchemaMessageHandler<Schema>>;

/** Typed `send` signature derived from a schema. */
export type SendMessage<Schema extends SocketSchema> = <K extends TopicKey<Schema>>(msg: {
  key: K;
  data: TopicPayload<Schema, K>;
}) => void;

/** Removes a subscription. Safe to call more than once. */
export type Unsubscribe = () => void;

/** JSON string envelope supported by the v1 default protocol. */
export type SocketStoreEnvelope = {
  key: string;
  data: unknown;
};

/** Incoming WebSocket message observed before protocol parsing. */
export type RawSocketStoreMessage = {
  data: unknown;
  event: MessageEvent;
};

/** Listener for raw WebSocket messages before protocol parsing. */
export type RawMessageListener = (message: RawSocketStoreMessage) => void;

/** Parsed message that the store deliberately leaves unrouted. */
export type UnhandledSocketStoreMessage = {
  key?: string;
  data: unknown;
};

export type UnhandledMessageListener = (
  message: UnhandledSocketStoreMessage
) => void;

/** Successful topic update observed after the topic state has changed. */
export type TopicUpdate<Schema extends SocketSchema = DefaultSchema> = {
  [K in TopicKey<Schema>]: {
    key: K;
    data: TopicPayload<Schema, K>;
    state: TopicState<Schema, K>;
  };
}[TopicKey<Schema>];

/** Listener for every successful topic update. */
export type TopicUpdateListener<Schema extends SocketSchema = DefaultSchema> = (
  update: TopicUpdate<Schema>
) => void;

export type SocketStoreErrorCode =
  | "ERR_SOCKET_ERROR"
  | "ERR_UNSUPPORTED_MESSAGE_DATA"
  | "ERR_INVALID_JSON"
  | "ERR_MALFORMED_ENVELOPE"
  | "ERR_INVALID_PROTOCOL_RESULT"
  | "ERR_PROTOCOL_PARSE_FAILED"
  | "ERR_PROTOCOL_SERIALIZE_FAILED"
  | "ERR_UNKNOWN_TOPIC"
  | "ERR_HANDLER_FAILED"
  | "ERR_SOCKET_NOT_OPEN";

export type SocketStoreErrorPhase =
  | "socket"
  | "parse"
  | "validate"
  | "route"
  | "handle"
  | "send";

export type SocketStoreErrorContext = {
  phase: SocketStoreErrorPhase;
  key?: string;
  data?: unknown;
  event?: Event;
  cause?: unknown;
};

export class SocketStoreError extends Error {
  name = "SocketStoreError";
  code: SocketStoreErrorCode;
  context: SocketStoreErrorContext;

  constructor(
    code: SocketStoreErrorCode,
    message: string,
    context: SocketStoreErrorContext
  ) {
    super(message);
    this.code = code;
    this.context = context;
  }
}

// ===== Fallback type for non-schema usage =====

/** @internal Default schema used when no explicit schema is provided. */
export type DefaultSchema = Record<string, { state: any; payload: any }>;

export type SocketStoreProtocolTopicResult = {
  type: "topic";
  key: string;
  data: unknown;
};

export type SocketStoreProtocolUnhandledResult = {
  type: "unhandled";
  key?: string;
  data: unknown;
};

export type SocketStoreProtocolIgnoreResult = {
  type: "ignore";
};

export type SocketStoreProtocolResult =
  | SocketStoreProtocolTopicResult
  | SocketStoreProtocolUnhandledResult
  | SocketStoreProtocolIgnoreResult;

export type SocketStoreProtocolParser = (
  event: MessageEvent
) => SocketStoreProtocolResult;

export type SocketStoreSendData = Parameters<WebSocket["send"]>[0];

export type SocketStoreOutgoingMessage<Schema extends SocketSchema> = {
  [K in TopicKey<Schema>]: {
    key: K;
    data: TopicPayload<Schema, K>;
  };
}[TopicKey<Schema>];

export type SocketStoreProtocolSerializer<Schema extends SocketSchema> = (
  message: SocketStoreOutgoingMessage<Schema>
) => SocketStoreSendData;

export type SocketStoreProtocol<Schema extends SocketSchema = DefaultSchema> = {
  parse?: SocketStoreProtocolParser;
  serialize?: SocketStoreProtocolSerializer<Schema>;
};

// ===== Store interfaces =====

export interface ISocketStore<Schema extends SocketSchema = DefaultSchema> {
  /**
   * method related to the socket
   */
  onConnect(): void;
  onMessage(message: MessageEvent): void;
  send<K extends TopicKey<Schema>>({ key, data }: { key: K; data: TopicPayload<Schema, K> }): void;

  /**
   * method related to the store
   */
  getState<K extends TopicKey<Schema>>(key: K): TopicState<Schema, K>;
  subscribe<K extends TopicKey<Schema>>(
    key: K,
    listener: (state: TopicState<Schema, K>) => void
  ): Unsubscribe;
  subscribeRaw(listener: RawMessageListener): Unsubscribe;
  subscribeAll(listener: TopicUpdateListener<Schema>): Unsubscribe;
  subscribeUnhandled(listener: UnhandledMessageListener): Unsubscribe;
  dispose(): void;
}

export type Store = {
  [key: string]: {
    state: any;
    callback: (state: any, data: any) => any;
  };
};

export interface ISocketStoreOptions<Schema extends SocketSchema = DefaultSchema> {
  onConnect?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: SocketStoreError) => void;
  protocol?: SocketStoreProtocol<Schema>;
}
