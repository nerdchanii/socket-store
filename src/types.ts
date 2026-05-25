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

/** Typed `send` signature derived from a schema. */
export type SendMessage<Schema extends SocketSchema> = <K extends TopicKey<Schema>>(msg: {
  key: K;
  data: TopicPayload<Schema, K>;
}) => void;

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
  ): void;
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
}
