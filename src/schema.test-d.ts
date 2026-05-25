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
  SendMessage,
  MessageHandler,
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

const chatHandler = createMessageHandler<Message[], Message>(
  "chat",
  (state, payload) => [...state, payload],
  []
);
// The returned callback must return S (Message[])
const _chatCb: (state: Message[], data: Message) => Message[] = chatHandler.callback;

// ---------------------------------------------------------------------------
// 5. Typed SocketStore
// ---------------------------------------------------------------------------

declare const ws: WebSocket;

// Instantiate with schema
const store = new SocketStore<AppSchema>(ws, [chatHandler]);

// getState — return type is inferred from the schema
const chatMessages: Message[] = store.getState("chat");
// @ts-expect-error — "unknown" is not a key in AppSchema
store.getState("unknown");

// subscribe — listener receives the correct state type
store.subscribe("chat", (msgs: Message[]) => {
  const _first: Message = msgs[0];
});
// @ts-expect-error — listener receives Message[], not string[]
store.subscribe("chat", (_msgs: string[]) => {});

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
