import { WebSocketServer } from "ws";

const PORT = 3030;
const server = new WebSocketServer({ port: PORT });

function send(socket, key, data) {
  socket.send(JSON.stringify({ key, data }));
}

function broadcast(key, data) {
  for (const client of server.clients) {
    if (client.readyState === client.OPEN) {
      send(client, key, data);
    }
  }
}

server.on("connection", (socket) => {
  send(socket, "status", { connected: true });
  send(socket, "talk", {
    name: "Server",
    message: "Welcome. Send a message to see topic state update.",
  });

  socket.on("message", (data) => {
    let envelope;

    try {
      envelope = JSON.parse(data.toString());
    } catch {
      send(socket, "talk", {
        name: "Server",
        message: "Received a non-JSON message.",
      });
      return;
    }

    if (envelope?.key !== "talk") {
      send(socket, "talk", {
        name: "Server",
        message: `Unhandled topic: ${String(envelope?.key)}`,
      });
      return;
    }

    broadcast("talk", envelope.data);
  });
});

server.on("listening", () => {
  console.log(`socket-store example server listening on ws://localhost:${PORT}`);
});
