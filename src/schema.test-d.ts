/**
 * Type-level tests for the schema-based topic contract.
 *
 * This file is checked by `tsc --noEmit`. Each `@ts-expect-error` comment
 * asserts that the following line MUST produce a type error; if it does not,
 * tsc itself fails, catching regressions in the type definitions.
 */

import { createMessageHandler, SocketStore } from "./index";
import type {
  SocketSchema,
  TopicKey,
  TopicState,
  TopicPayload,
  TopicHandler,
  SchemaMessageHandler,
  SocketStoreMessageHandlers,
  SendMessage,
  SocketStoreAdapterContract,
  SocketStoreSender,
  SocketStoreStateGetter,
  SocketStoreSubscriber,
  SocketStoreConnectionStatus,
  SocketStoreStatusGetter,
  SocketStoreStatusSubscriber,
  TopicStateListener,
  TopicUpdate,
  Unsubscribe,
  MessageHandler,
  SocketStoreProtocol,
  SocketStoreProtocolResult,
} from "./index";

// ---------------------------------------------------------------------------
// 1. Schema definition
// ---------------------------------------------------------------------------

type Message = { author: string; text: string };
type PriceTick = { symbol: string; value: number };
type Price = number | null;

type AppSchema = {
  chat: { state: Message[]; payload: Message };
  price: { state: Price; payload: PriceTick };
};

// ---------------------------------------------------------------------------
// 2. Utility type assertions
// ---------------------------------------------------------------------------

// TopicKey extracts the union of keys
type Keys = TopicKey<AppSchema>;
const _validKey: Keys = "chat";
const _validKey2: Keys = "price";
// @ts-expect-error — "unknown" is not a key in AppSchema
const _badKey: Keys = "unknown";

// TopicState maps a key to its state type
type ChatState = TopicState<AppSchema, "chat">;
const _chatState: ChatState = [{ author: "alice", text: "hi" }];
// @ts-expect-error — string is not Message[]
const _badChatState: ChatState = "wrong";

// TopicPayload maps a key to its payload type
type PricePayload = TopicPayload<AppSchema, "price">;
const _pricePayload: PricePayload = { symbol: "BTC", value: 42000 };
// @ts-expect-error — string is not PriceTick
const _badPricePayload: PricePayload = "wrong";

// TopicHandler must return the state type
type ChatHandler = TopicHandler<AppSchema, "chat">;
const _chatHandler: ChatHandler = (state, payload) => [...state, payload];
// @ts-expect-error — handler must return Message[], not void
const _badChatHandler: ChatHandler = (_state, _payload) => {
  // intentionally returns nothing (void)
};

// SendMessage constrains key and data together
type AppSend = SendMessage<AppSchema>;
declare const send: AppSend;
send({ key: "chat", data: { author: "bob", text: "hello" } }); // valid
// @ts-expect-error — "unknown" is not a key in AppSchema
send({ key: "unknown", data: {} });
// @ts-expect-error — PriceTick is not valid for the "chat" topic
send({ key: "chat", data: { symbol: "BTC", value: 1 } });

// Adapter contract types expose the narrow store surface needed by frameworks
type AppStateGetter = SocketStoreStateGetter<AppSchema>;
declare const getTopicState: AppStateGetter;
const _adapterChatState: Message[] = getTopicState("chat");
// @ts-expect-error — "unknown" is not a key in AppSchema
getTopicState("unknown");

type AppSender = SocketStoreSender<AppSchema>;
declare const sendTopicMessage: AppSender;
sendTopicMessage({ key: "price", data: { symbol: "ETH", value: 2 } });
// @ts-expect-error — payload must match the selected topic
sendTopicMessage({ key: "price", data: { author: "bob", text: "hello" } });

type AppTopicListener = TopicStateListener<AppSchema, "price">;
const _priceListener: AppTopicListener = (price) => {
  const _price: Price = price;
};
// @ts-expect-error — listener receives Price, not Message[]
const _badPriceListener: AppTopicListener = (_messages: Message[]) => {};

type AppSubscriber = SocketStoreSubscriber<AppSchema>;
declare const subscribeToTopic: AppSubscriber;
subscribeToTopic("chat", (messages) => {
  const _messages: Message[] = messages;
});
// @ts-expect-error — listener state must match the topic
subscribeToTopic("chat", (_price: Price) => {});

type AppStatusGetter = SocketStoreStatusGetter;
declare const getStatus: AppStatusGetter;
const _status: SocketStoreConnectionStatus = getStatus();
// @ts-expect-error — status values are the documented string union
const _badStatus: SocketStoreConnectionStatus = "retrying";

type AppStatusSubscriber = SocketStoreStatusSubscriber;
declare const subscribeToStatus: AppStatusSubscriber;
const _statusUnsubscribe: Unsubscribe = subscribeToStatus((status) => {
  const _status: SocketStoreConnectionStatus = status;
});

declare const adapterStore: SocketStoreAdapterContract<AppSchema>;
adapterStore.send({ key: "chat", data: { author: "ada", text: "hi" } });
const _adapterPrice: Price = adapterStore.getState("price");
const _adapterStatus: SocketStoreConnectionStatus = adapterStore.getStatus();
const _adapterUnsubscribe: Unsubscribe = adapterStore.subscribe("price", (price) => {
  const _price: Price = price;
});
_adapterUnsubscribe();

// ---------------------------------------------------------------------------
// 3. MessageHandler type consistency
// ---------------------------------------------------------------------------

// callback must return S (not void)
type PriceHandler = MessageHandler<Price, PriceTick>;
const _priceHandler: PriceHandler = {
  key: "price",
  callback: (_state, tick) => tick.value,
  state: null,
};
const _badPriceHandler: PriceHandler = {
  key: "price",
  // @ts-expect-error — callback must return Price, not void
  callback: (_state, _tick) => {
    // returns nothing
  },
  state: null,
};

// ---------------------------------------------------------------------------
// 4. createMessageHandler return type
// ---------------------------------------------------------------------------

const chatHandler = createMessageHandler(
  "chat",
  (state: Message[], payload: Message) => [...state, payload],
  [] as Message[]
);
const priceStoreHandler = createMessageHandler(
  "price",
  (_state: Price, payload: PriceTick) => payload.value,
  null as Price
);
// The returned callback must return S (Message[])
const _chatCb: (state: Message[], data: Message) => Message[] = chatHandler.callback;

const _schemaHandler: SchemaMessageHandler<AppSchema> = chatHandler;
// @ts-expect-error — handler key must exist in AppSchema
const _unknownSchemaHandler: SchemaMessageHandler<AppSchema> = createMessageHandler(
  "unknown",
  (state: number, payload: number) => state + payload,
  0
);
// @ts-expect-error — "chat" handler state must be Message[], not string
const _badSchemaHandler: SchemaMessageHandler<AppSchema> = createMessageHandler(
  "chat",
  (state: string, payload: Message) => state + payload.text,
  ""
);

const _schemaHandlers: SocketStoreMessageHandlers<AppSchema> = [
  chatHandler,
  priceStoreHandler,
];

// ---------------------------------------------------------------------------
// 5. Typed SocketStore
// ---------------------------------------------------------------------------

declare const ws: WebSocket;

// Instantiate with schema
const store = new SocketStore<AppSchema>(ws, [chatHandler, priceStoreHandler]);
new SocketStore<AppSchema>(ws, [
  // @ts-expect-error — constructor handlers must match the schema topic contract
  createMessageHandler("chat", (state: string, payload: Message) => state + payload.text, ""),
]);

// getState — return type is inferred from the schema
const chatMessages: Message[] = store.getState("chat");
// @ts-expect-error — "unknown" is not a key in AppSchema
store.getState("unknown");
const connectionStatus: SocketStoreConnectionStatus = store.getStatus();

// subscribe — listener receives the correct state type
const unsubscribe: Unsubscribe = store.subscribe("chat", (msgs: Message[]) => {
  const _first: Message = msgs[0];
});
unsubscribe();
// @ts-expect-error — listener receives Message[], not string[]
store.subscribe("chat", (_msgs: string[]) => {});

store.subscribeStatus((status) => {
  const _status: SocketStoreConnectionStatus = status;
});

store.subscribeAll((update) => {
  const _key: "chat" | "price" = update.key;

  if (update.key === "chat") {
    const _chatState: Message[] = update.state;
    const _chatData: Message = update.data;
  } else {
    const _priceState: Price = update.state;
    const _priceData: PriceTick = update.data;
  }
});

const _chatUpdate: TopicUpdate<AppSchema> = {
  key: "chat",
  state: [{ author: "dan", text: "hi" }],
  data: { author: "dan", text: "hi" },
};
const _badChatUpdate: TopicUpdate<AppSchema> = {
  key: "chat",
  state: [],
  // @ts-expect-error — all-topic update data must match its topic payload
  data: { symbol: "BTC", value: 1 },
};

store.subscribeRaw((message) => {
  const _data: unknown = message.data;
  const _event: MessageEvent = message.event;
});

store.subscribeUnhandled((message) => {
  const _key: string | undefined = message.key;
  const _data: unknown = message.data;
});

const _protocol: SocketStoreProtocol<AppSchema> = {
  parse(event): SocketStoreProtocolResult {
    const payload = JSON.parse(event.data as string) as {
      topic?: string;
      payload?: unknown;
      ignored?: boolean;
    };

    if (payload.ignored) {
      return { type: "ignore" };
    }

    if (!payload.topic) {
      return { type: "unhandled", data: payload };
    }

    return { type: "topic", key: payload.topic, data: payload.payload };
  },
  serialize(message) {
    if (message.key === "chat") {
      const _chatPayload: Message = message.data;
      return JSON.stringify({ topic: message.key, payload: _chatPayload });
    }

    const _pricePayload: PriceTick = message.data;
    return JSON.stringify({ topic: message.key, payload: _pricePayload });
  },
};

new SocketStore<AppSchema>(ws, [chatHandler, priceStoreHandler], {
  protocol: _protocol,
});

// send — data must match the payload type for the given key
store.send({ key: "chat", data: { author: "carol", text: "hey" } });
// @ts-expect-error — PriceTick is not valid payload for "chat"
store.send({ key: "chat", data: { symbol: "ETH", value: 2 } });
// @ts-expect-error — "unknown" is not a key in AppSchema
store.send({ key: "unknown", data: {} });

// ---------------------------------------------------------------------------
// 6. Non-schema (default) usage still works without generics
// ---------------------------------------------------------------------------

const looseStore = new SocketStore(ws, [chatHandler]);
const _anything: any = looseStore.getState("chat");
looseStore.subscribe("chat", (_state: any) => {});
looseStore.send({ key: "chat", data: "anything goes" });
