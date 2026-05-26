import { createMessageHandler, SocketStore } from "../../../src/index";
import type { SocketStoreError } from "../../../src/index";

type ChatMessage = {
  name: string;
  message: string;
};

type ConnectionStatus = {
  connected: boolean;
};

type ExampleSchema = {
  talk: { state: ChatMessage[]; payload: ChatMessage };
  status: { state: ConnectionStatus; payload: ConnectionStatus };
};

const messages = document.querySelector<HTMLUListElement>("#messages");
const status = document.querySelector<HTMLParagraphElement>("#status");
const form = document.querySelector<HTMLFormElement>("#message-form");
const input = document.querySelector<HTMLInputElement>("#message-input");
const button = document.querySelector<HTMLButtonElement>("#send-button");

if (!messages || !status || !form || !input || !button) {
  throw new Error("Example DOM is missing required elements.");
}

const talkHandler = createMessageHandler<ChatMessage[], ChatMessage, "talk">(
  "talk",
  (state, payload) => [...state, payload],
  []
);

const statusHandler = createMessageHandler<
  ConnectionStatus,
  ConnectionStatus,
  "status"
>("status", (_state, payload) => payload, { connected: false });

const socket = new WebSocket("ws://localhost:3030");
const store = new SocketStore<ExampleSchema>(socket, [
  talkHandler,
  statusHandler,
], {
  onConnect() {
    status.textContent = "Connected to ws://localhost:3030";
    button.disabled = false;
  },
  onClose() {
    status.textContent = "Disconnected from ws://localhost:3030";
    button.disabled = true;
  },
  onError(error: SocketStoreError) {
    status.textContent = `${error.code}: ${error.message}`;
  },
});

store.subscribe("status", (snapshot) => {
  status.textContent = snapshot.connected
    ? "Connected to ws://localhost:3030"
    : "Disconnected from ws://localhost:3030";
});

store.subscribe("talk", (snapshot) => {
  messages.replaceChildren(
    ...snapshot.map((entry) => {
      const item = document.createElement("li");
      item.innerHTML = "<strong></strong>: <span></span>";
      item.querySelector("strong")!.textContent = entry.name;
      item.querySelector("span")!.textContent = entry.message;
      return item;
    })
  );
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const message = input.value.trim();
  if (!message) {
    return;
  }

  store.send({
    key: "talk",
    data: {
      name: "Browser",
      message,
    },
  });
  input.value = "";
});
