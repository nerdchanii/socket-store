import { describe, expect, it, vi } from "vitest";
import { createMessageHandler, SocketStore, SocketStoreError } from "./index";
import type { SocketStoreSendData } from "./index";

type Listener = (event: any) => void;

class FakeWebSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readyState = FakeWebSocket.OPEN;
  sent: SocketStoreSendData[] = [];
  listeners = new Map<string, Set<Listener>>();
  sendError?: unknown;

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: SocketStoreSendData) {
    if (this.sendError) {
      throw this.sendError;
    }

    this.sent.push(data);
  }

  close() {
    this.readyState = FakeWebSocket.CLOSING;
  }

  dispatch(type: string, event: Record<string, unknown> = {}) {
    if (type === "open") {
      this.readyState = FakeWebSocket.OPEN;
    }

    if (type === "close") {
      this.readyState = FakeWebSocket.CLOSED;
    }

    const listeners = [...(this.listeners.get(type) ?? [])];
    listeners.forEach((listener) => listener(event));
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function createStore(
  options?: ConstructorParameters<typeof SocketStore>[2],
  readyState = FakeWebSocket.OPEN
) {
  const socket = new FakeWebSocket();
  socket.readyState = readyState;
  const store = new SocketStore(
    socket as unknown as WebSocket,
    [
      createMessageHandler("chat", (state: string[], data: string) => [...state, data], []),
      createMessageHandler("price", (_state: number | null, data: number) => data, null),
    ],
    options
  );

  return { socket, store };
}

describe("SocketStore", () => {
  it("initializes topic snapshots and updates them from message envelopes", () => {
    const { socket, store } = createStore();

    expect(store.getState("chat")).toEqual([]);

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "hello" }),
    });

    expect(store.getState("chat")).toEqual(["hello"]);
  });

  it("exposes the initial connection status snapshot", () => {
    expect(createStore(undefined, FakeWebSocket.CONNECTING).store.getStatus()).toBe(
      "connecting"
    );
    expect(createStore(undefined, FakeWebSocket.OPEN).store.getStatus()).toBe("open");
    expect(createStore(undefined, FakeWebSocket.CLOSING).store.getStatus()).toBe(
      "closing"
    );
    expect(createStore(undefined, FakeWebSocket.CLOSED).store.getStatus()).toBe(
      "closed"
    );
  });

  it("notifies status subscribers when the socket opens and closes", () => {
    const { socket, store } = createStore(undefined, FakeWebSocket.CONNECTING);
    const listener = vi.fn();

    store.subscribeStatus(listener);
    socket.dispatch("open");
    socket.dispatch("open");
    socket.dispatch("close");

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls.map((call) => call[0])).toEqual(["open", "closed"]);
    expect(store.getStatus()).toBe("closed");
  });

  it("reflects native closing readyState in the current status snapshot", () => {
    const { socket, store } = createStore();

    socket.close();

    expect(store.getStatus()).toBe("closing");
  });

  it("notifies status subscribers when the provided socket starts closing", () => {
    const { socket, store } = createStore();
    const listener = vi.fn();

    store.subscribeStatus(listener);
    socket.close();
    socket.dispatch("close");

    expect(listener.mock.calls.map((call) => call[0])).toEqual([
      "closing",
      "closed",
    ]);
  });

  it("returns idempotent unsubscribe functions from status subscriptions", () => {
    const { socket, store } = createStore(undefined, FakeWebSocket.CONNECTING);
    const listener = vi.fn();

    const unsubscribe = store.subscribeStatus(listener);

    socket.dispatch("open");
    unsubscribe();
    unsubscribe();
    socket.dispatch("close");

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith("open");
    expect(store.getStatus()).toBe("closed");
  });

  it("notifies raw message subscribers before parsing", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({ onError });
    const rawListener = vi.fn();
    const invalidMessage = { data: "{" };

    store.subscribeRaw(rawListener);
    socket.dispatch("message", invalidMessage);

    expect(rawListener).toHaveBeenCalledWith({
      data: "{",
      event: invalidMessage,
    });
    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0].code).toBe("ERR_INVALID_JSON");
  });

  it("notifies all-topic subscribers after successful topic updates", () => {
    const { socket, store } = createStore();
    const allListener = vi.fn();
    const topicListener = vi.fn(() => {
      expect(store.getState("chat")).toEqual(["hello"]);
    });

    store.subscribe("chat", topicListener);
    store.subscribeAll(allListener);

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "hello" }),
    });

    expect(topicListener).toHaveBeenCalledWith(["hello"]);
    expect(allListener).toHaveBeenCalledWith({
      key: "chat",
      data: "hello",
      state: ["hello"],
    });
  });

  it("notifies unhandled subscribers for parsed messages with no registered handler", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({ onError });
    const unhandledListener = vi.fn();

    store.subscribeUnhandled(unhandledListener);
    socket.dispatch("message", {
      data: JSON.stringify({ key: "unknown", data: "ignored" }),
    });

    expect(unhandledListener).toHaveBeenCalledWith({
      key: "unknown",
      data: "ignored",
    });
    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0].code).toBe("ERR_UNKNOWN_TOPIC");
    expect(store.getState("chat")).toEqual([]);
  });

  it("serializes outgoing messages after checking socket readiness", () => {
    const { socket, store } = createStore();

    store.send({ key: "chat", data: "hello" });

    expect(socket.sent).toEqual([JSON.stringify({ key: "chat", data: "hello" })]);
  });

  it("uses custom protocol serializers for outgoing messages", () => {
    const { socket, store } = createStore({
      protocol: {
        serialize({ key, data }) {
          return new TextEncoder().encode(
            JSON.stringify({ topic: key, payload: data })
          ).buffer;
        },
      },
    });

    store.send({ key: "chat", data: "hello" });

    expect(socket.sent[0]).toBeInstanceOf(ArrayBuffer);
    expect(new TextDecoder().decode(socket.sent[0] as ArrayBuffer)).toBe(
      JSON.stringify({ topic: "chat", payload: "hello" })
    );
  });

  it("preserves custom serializer method context", () => {
    const protocol = {
      prefix: "encoded:",
      serialize({ key, data }: { key: string; data: unknown }) {
        return `${this.prefix}${JSON.stringify({ topic: key, payload: data })}`;
      },
    };
    const { socket, store } = createStore({ protocol });

    store.send({ key: "chat", data: "hello" });

    expect(socket.sent).toEqual([
      'encoded:{"topic":"chat","payload":"hello"}',
    ]);
  });

  it.each([
    ["connecting", FakeWebSocket.CONNECTING],
    ["closing", FakeWebSocket.CLOSING],
    ["closed", FakeWebSocket.CLOSED],
  ])(
    "rejects send without queueing while the socket is %s",
    (_status, readyState) => {
      const serialize = vi.fn(({ key, data }) => JSON.stringify({ key, data }));
      const { socket, store } = createStore({
        protocol: { serialize },
      });
      socket.readyState = readyState;

      let error: unknown;
      try {
        store.send({ key: "chat", data: "hello" });
      } catch (caught) {
        error = caught;
      }

      expect(error).toBeInstanceOf(SocketStoreError);
      expect((error as SocketStoreError).code).toBe("ERR_SOCKET_NOT_OPEN");
      expect((error as SocketStoreError).context).toMatchObject({
        phase: "send",
        key: "chat",
        data: "hello",
      });
      expect(serialize).not.toHaveBeenCalled();
      expect(socket.sent).toEqual([]);
    }
  );

  it("returns idempotent unsubscribe functions from subscribe", () => {
    const { socket, store } = createStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe("chat", listener);

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "first" }),
    });
    unsubscribe();
    unsubscribe();
    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "second" }),
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(["first"]);
    expect(store.getState("chat")).toEqual(["first", "second"]);
  });

  it("returns idempotent unsubscribe functions from raw, all-topic, and unhandled subscriptions", () => {
    const { socket, store } = createStore();
    const rawListener = vi.fn();
    const allListener = vi.fn();
    const unhandledListener = vi.fn();

    const unsubscribeRaw = store.subscribeRaw(rawListener);
    const unsubscribeAll = store.subscribeAll(allListener);
    const unsubscribeUnhandled = store.subscribeUnhandled(unhandledListener);

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "first" }),
    });
    socket.dispatch("message", {
      data: JSON.stringify({ key: "unknown", data: "ignored" }),
    });

    unsubscribeRaw();
    unsubscribeRaw();
    unsubscribeAll();
    unsubscribeAll();
    unsubscribeUnhandled();
    unsubscribeUnhandled();

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "second" }),
    });
    socket.dispatch("message", {
      data: JSON.stringify({ key: "missing", data: "ignored" }),
    });

    expect(rawListener).toHaveBeenCalledTimes(2);
    expect(allListener).toHaveBeenCalledTimes(1);
    expect(unhandledListener).toHaveBeenCalledTimes(1);
  });

  it("removes duplicate raw, all-topic, and unhandled subscriptions independently", () => {
    const { socket, store } = createStore();
    const rawListener = vi.fn();
    const allListener = vi.fn();
    const unhandledListener = vi.fn();

    const unsubscribeRaw = store.subscribeRaw(rawListener);
    store.subscribeRaw(rawListener);
    const unsubscribeAll = store.subscribeAll(allListener);
    store.subscribeAll(allListener);
    const unsubscribeUnhandled = store.subscribeUnhandled(unhandledListener);
    store.subscribeUnhandled(unhandledListener);

    unsubscribeRaw();
    unsubscribeAll();
    unsubscribeUnhandled();

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "hello" }),
    });
    socket.dispatch("message", {
      data: JSON.stringify({ key: "unknown", data: "ignored" }),
    });

    expect(rawListener).toHaveBeenCalledTimes(2);
    expect(allListener).toHaveBeenCalledTimes(1);
    expect(unhandledListener).toHaveBeenCalledTimes(1);
  });

  it("notifies duplicate subscriptions independently and preserves notification order", () => {
    const { socket, store } = createStore();
    const calls: string[] = [];

    store.subscribe("chat", () => calls.push("first"));
    store.subscribe("chat", () => calls.push("second"));

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "hello" }),
    });

    expect(calls).toEqual(["first", "second"]);
  });

  it("uses a stable listener snapshot when listeners unsubscribe during notification", () => {
    const { socket, store } = createStore();
    const calls: string[] = [];
    const unsubscribeFirst = store.subscribe("chat", () => {
      calls.push("first");
      unsubscribeSecond();
    });
    const unsubscribeSecond = store.subscribe("chat", () => {
      calls.push("second");
    });

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "hello" }),
    });
    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "again" }),
    });

    unsubscribeFirst();
    expect(calls).toEqual(["first", "second", "first"]);
  });

  it("reports malformed input through onError", () => {
    const onError = vi.fn();
    const { socket } = createStore({ onError });

    socket.dispatch("message", { data: "{" });
    socket.dispatch("message", { data: JSON.stringify({ data: "missing key" }) });
    socket.dispatch("message", { data: new Uint8Array() });

    expect(onError).toHaveBeenCalledTimes(3);
    expect(onError.mock.calls.map((call) => call[0].code)).toEqual([
      "ERR_INVALID_JSON",
      "ERR_MALFORMED_ENVELOPE",
      "ERR_UNSUPPORTED_MESSAGE_DATA",
    ]);
    expect(onError.mock.calls.every((call) => call[0] instanceof SocketStoreError)).toBe(true);
  });

  it("routes custom protocol topic results", () => {
    const { socket, store } = createStore({
      protocol: {
        parse(event) {
          const payload = JSON.parse(event.data as string) as {
            topic: string;
            payload: unknown;
          };

          return {
            type: "topic",
            key: payload.topic,
            data: payload.payload,
          };
        },
      },
    });

    socket.dispatch("message", {
      data: JSON.stringify({ topic: "chat", payload: "hello" }),
    });

    expect(store.getState("chat")).toEqual(["hello"]);
  });

  it("preserves custom parser method context", () => {
    const protocol = {
      topic: "chat",
      parse(event: MessageEvent) {
        return {
          type: "topic" as const,
          key: this.topic,
          data: event.data,
        };
      },
    };
    const { socket, store } = createStore({ protocol });

    socket.dispatch("message", { data: "hello" });

    expect(store.getState("chat")).toEqual(["hello"]);
  });

  it("lets custom parsers map ArrayBuffer message data", () => {
    const { socket, store } = createStore({
      protocol: {
        parse(event) {
          const payload = JSON.parse(
            new TextDecoder().decode(event.data as ArrayBuffer)
          ) as {
            topic: string;
            payload: unknown;
          };

          return {
            type: "topic",
            key: payload.topic,
            data: payload.payload,
          };
        },
      },
    });
    const data = new TextEncoder().encode(
      JSON.stringify({ topic: "chat", payload: "from binary" })
    ).buffer;

    socket.dispatch("message", { data });

    expect(store.getState("chat")).toEqual(["from binary"]);
  });

  it("lets custom parsers ignore messages", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({
      onError,
      protocol: {
        parse() {
          return { type: "ignore" };
        },
      },
    });

    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "ignored" }),
    });

    expect(store.getState("chat")).toEqual([]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("notifies unhandled custom parser results without routing errors", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({
      onError,
      protocol: {
        parse(event) {
          return { type: "unhandled", data: event.data };
        },
      },
    });
    const unhandled = vi.fn();

    store.subscribeUnhandled(unhandled);
    socket.dispatch("message", {
      data: JSON.stringify({ type: "heartbeat" }),
    });

    expect(unhandled).toHaveBeenCalledWith({
      key: undefined,
      data: JSON.stringify({ type: "heartbeat" }),
    });
    expect(onError).not.toHaveBeenCalled();
  });

  it("reports custom parser failures through onError", () => {
    const onError = vi.fn();
    const cause = new Error("boom");
    const { socket } = createStore({
      onError,
      protocol: {
        parse() {
          throw cause;
        },
      },
    });

    socket.dispatch("message", { data: new ArrayBuffer(8) });

    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_PROTOCOL_PARSE_FAILED",
      context: {
        phase: "parse",
        data: expect.any(ArrayBuffer),
        cause,
      },
    });
  });

  it("reports invalid custom parser results through onError", () => {
    const onError = vi.fn();
    const { socket } = createStore({
      onError,
      protocol: {
        parse() {
          return { type: "topic" } as never;
        },
      },
    });

    socket.dispatch("message", { data: "anything" });

    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_INVALID_PROTOCOL_RESULT",
      context: {
        phase: "validate",
        data: { type: "topic" },
      },
    });
  });

  it("reports custom serializer failures through onError and throws", () => {
    const onError = vi.fn();
    const cause = new Error("cannot encode");
    const { socket, store } = createStore({
      onError,
      protocol: {
        serialize() {
          throw cause;
        },
      },
    });

    expect(() => store.send({ key: "chat", data: "hello" })).toThrow(SocketStoreError);
    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_PROTOCOL_SERIALIZE_FAILED",
      context: {
        phase: "send",
        key: "chat",
        data: "hello",
        cause,
      },
    });
    expect(socket.sent).toEqual([]);
  });

  it("reports send-time serializer payload failures through onError and throws", () => {
    const onError = vi.fn();
    const cause = new TypeError("unsupported payload");
    const { socket, store } = createStore({
      onError,
      protocol: {
        serialize() {
          return { unsupported: true } as never;
        },
      },
    });
    socket.sendError = cause;

    expect(() => store.send({ key: "chat", data: "hello" })).toThrow(SocketStoreError);
    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_PROTOCOL_SERIALIZE_FAILED",
      context: {
        phase: "send",
        key: "chat",
        data: "hello",
        cause,
      },
    });
    expect(socket.sent).toEqual([]);
  });

  it("reports unknown topic envelopes through onError", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({ onError });

    socket.dispatch("message", {
      data: JSON.stringify({ key: "unknown", data: "ignored" }),
    });

    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_UNKNOWN_TOPIC",
      context: {
        phase: "route",
        key: "unknown",
        data: { key: "unknown", data: "ignored" },
      },
    });
    expect(store.getState("chat")).toEqual([]);
  });

  it("routes prototype property keys as unknown topics", () => {
    const onError = vi.fn();
    const { socket } = createStore({ onError });

    socket.dispatch("message", {
      data: JSON.stringify({ key: "toString", data: "ignored" }),
    });

    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_UNKNOWN_TOPIC",
      context: {
        phase: "route",
        key: "toString",
      },
    });
  });

  it("wraps native WebSocket error events in SocketStoreError", () => {
    const onError = vi.fn();
    const { socket, store } = createStore({ onError });
    const event = new Event("error");

    socket.dispatch("error", event);

    expect(store.getStatus()).toBe("open");
    expect(onError).toHaveBeenCalledWith(expect.any(SocketStoreError));
    expect(onError.mock.calls[0][0]).toMatchObject({
      code: "ERR_SOCKET_ERROR",
      context: {
        phase: "socket",
        event,
      },
    });
  });

  it("does not throw async message errors when onError is not provided", () => {
    const { socket } = createStore();

    expect(() => {
      socket.dispatch("message", { data: "{" });
    }).not.toThrow();
  });

  it("does not throw native socket error events when onError is not provided", () => {
    const { socket } = createStore();

    expect(() => {
      socket.dispatch("error", new Event("error"));
    }).not.toThrow();
  });

  it("fails early for duplicate handler keys", () => {
    const socket = new FakeWebSocket();

    expect(
      () =>
        new SocketStore(socket as unknown as WebSocket, [
          createMessageHandler("chat", (state: string[], data: string) => [...state, data], []),
          createMessageHandler("chat", (state: string[], data: string) => [...state, data], []),
        ])
    ).toThrow("Duplicate socket-store handler key: chat");
  });

  it("does not attach socket listeners when duplicate handler validation fails", () => {
    const socket = new FakeWebSocket();

    expect(
      () =>
        new SocketStore(socket as unknown as WebSocket, [
          createMessageHandler("chat", (state: string[], data: string) => [...state, data], []),
          createMessageHandler("chat", (state: string[], data: string) => [...state, data], []),
        ])
    ).toThrow("Duplicate socket-store handler key: chat");

    expect(socket.listenerCount("open")).toBe(0);
    expect(socket.listenerCount("message")).toBe(0);
    expect(socket.listenerCount("error")).toBe(0);
    expect(socket.listenerCount("close")).toBe(0);
  });

  it("allows prototype property names as first-time handler keys", () => {
    const socket = new FakeWebSocket();
    const store = new SocketStore(socket as unknown as WebSocket, [
      createMessageHandler("toString", (state: string[], data: string) => [...state, data], []),
      createMessageHandler("__proto__", (state: string[], data: string) => [...state, data], []),
    ]);

    socket.dispatch("message", {
      data: JSON.stringify({ key: "toString", data: "hello" }),
    });
    socket.dispatch("message", {
      data: JSON.stringify({ key: "__proto__", data: "safe" }),
    });

    expect(store.getState("toString")).toEqual(["hello"]);
    expect(store.getState("__proto__")).toEqual(["safe"]);
  });

  it("removes native listeners and clears subscriptions on dispose", () => {
    const listener = vi.fn();
    const statusListener = vi.fn();
    const onConnect = vi.fn();
    const { socket, store } = createStore({ onConnect });

    store.subscribe("chat", listener);
    store.subscribeStatus(statusListener);
    expect(socket.listenerCount("open")).toBe(1);
    expect(socket.listenerCount("message")).toBe(1);

    store.dispose();
    store.dispose();

    expect(socket.listenerCount("open")).toBe(0);
    expect(socket.listenerCount("message")).toBe(0);

    socket.dispatch("open");
    socket.dispatch("message", {
      data: JSON.stringify({ key: "chat", data: "ignored" }),
    });

    expect(onConnect).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
    expect(statusListener).not.toHaveBeenCalled();
    expect(store.getState("chat")).toEqual([]);
  });

  it("rejects new subscriptions and sends after disposal but preserves readable snapshots", () => {
    const { store } = createStore();

    store.dispose();

    expect(store.getState("chat")).toEqual([]);
    expect(() => store.subscribe("chat", () => undefined)).toThrow(
      "Cannot subscribe after SocketStore has been disposed"
    );
    expect(() => store.subscribeRaw(() => undefined)).toThrow(
      "Cannot subscribe after SocketStore has been disposed"
    );
    expect(() => store.subscribeAll(() => undefined)).toThrow(
      "Cannot subscribe after SocketStore has been disposed"
    );
    expect(() => store.subscribeUnhandled(() => undefined)).toThrow(
      "Cannot subscribe after SocketStore has been disposed"
    );
    expect(() => store.subscribeStatus(() => undefined)).toThrow(
      "Cannot subscribe after SocketStore has been disposed"
    );
    expect(() => store.send({ key: "chat", data: "hello" })).toThrow(
      "Cannot send after SocketStore has been disposed"
    );
  });
});
