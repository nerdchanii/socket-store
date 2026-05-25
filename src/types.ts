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

export type SocketStoreMessageErrorReason =
  | "non-string-message"
  | "invalid-json"
  | "malformed-envelope"
  | "handler-error";

// ===== Fallback type for non-schema usage =====

/** @internal Default schema used when no explicit schema is provided. */
export type DefaultSchema = Record<string, { state: any; payload: any }>;

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
  dispose(): void;
}

export type Store = {
  [key: string]: {
    state: any;
    callback: (state: any, data: any) => any;
  };
};

export interface ISocketStoreOptions {
  onConnect?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: Event) => void;
  onMessageError?: (
    error: Error,
    context: {
      reason: SocketStoreMessageErrorReason;
      data: unknown;
    }
  ) => void;
  onUnknownMessage?: (message: SocketStoreEnvelope) => void;
}
