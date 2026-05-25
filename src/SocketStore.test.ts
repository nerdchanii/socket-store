import { describe, expect, it, vi } from "vitest";
import { createMessageHandler, SocketStore } from "./index";

type Listener = (event: any) => void;

class FakeWebSocket {
  static readonly OPEN = 1;

  readyState = FakeWebSocket.OPEN;
  sent: string[] = [];
  listeners = new Map<string, Set<Listener>>();

  addEventListener(type: string, listener: Listener) {
    const listeners = this.listeners.get(type) ?? new Set<Listener>();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  send(data: string) {
    this.sent.push(data);
  }

  dispatch(type: string, event: Record<string, unknown> = {}) {
    const listeners = [...(this.listeners.get(type) ?? [])];
    listeners.forEach((listener) => listener(event));
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0;
  }
}

function createStore(options?: ConstructorParameters<typeof SocketStore>[2]) {
  const socket = new FakeWebSocket();
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

  it("serializes outgoing messages after checking socket readiness", () => {
    const { socket, store } = createStore();

    store.send({ key: "chat", data: "hello" });

    expect(socket.sent).toEqual([JSON.stringify({ key: "chat", data: "hello" })]);
  });

  it("throws before sending when the socket is not open", () => {
    const { socket, store } = createStore();
    socket.readyState = 0;

    expect(() => store.send({ key: "chat", data: "hello" })).toThrow(
      "WebSocket is not open"
    );
    expect(socket.sent).toEqual([]);
  });

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

  it("reports malformed input through onMessageError", () => {
    const onMessageError = vi.fn();
    const { socket } = createStore({ onMessageError });

    socket.dispatch("message", { data: "{" });
    socket.dispatch("message", { data: JSON.stringify({ data: "missing key" }) });
    socket.dispatch("message", { data: new Uint8Array() });

    expect(onMessageError).toHaveBeenCalledTimes(3);
    expect(onMessageError.mock.calls.map((call) => call[1].reason)).toEqual([
      "invalid-json",
      "malformed-envelope",
      "non-string-message",
    ]);
  });

  it("routes unknown topic envelopes through onUnknownMessage", () => {
    const onUnknownMessage = vi.fn();
    const { socket, store } = createStore({ onUnknownMessage });

    socket.dispatch("message", {
      data: JSON.stringify({ key: "unknown", data: "ignored" }),
    });

    expect(onUnknownMessage).toHaveBeenCalledWith({
      key: "unknown",
      data: "ignored",
    });
    expect(store.getState("chat")).toEqual([]);
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
});
