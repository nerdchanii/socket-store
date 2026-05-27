# Runnable WebSocket Example

The canonical runnable example lives in
[`examples/basic`](https://github.com/nerdchanii/socket-store/tree/main/examples/basic).
It uses the default socket-store envelope:

```json
{ "key": "talk", "data": { "name": "Browser", "message": "Hello" } }
```

## Run From A Clean Checkout

Install dependencies:

```sh
npm install
```

Start the local WebSocket server:

```sh
npm run example:server
```

Expected server output:

```text
socket-store example server listening on ws://localhost:3030
```

In a second terminal, start the browser client:

```sh
npm run example:client
```

Open the Vite URL printed by the client command.

## Expected Flow

The browser connects to `ws://localhost:3030`, then the example server sends:

```json
{ "key": "status", "data": { "connected": true } }
```

The `status` topic updates the connection text in the browser. The server also
sends an initial `talk` topic message:

```json
{
  "key": "talk",
  "data": {
    "name": "Server",
    "message": "Welcome. Send a message to see topic state update."
  }
}
```

Type a message in the input and submit the form. The browser calls
`store.send(...)` with a `talk` envelope, the server broadcasts that envelope to
connected clients, and the `talk` topic snapshot appends the message to the
list.

## Cleanup

Stop both terminals with <kbd>Ctrl</kbd> + <kbd>C</kbd>.

The example does not persist state or write runtime files. Stopping the server
closes client WebSocket connections, releases port `3030`, and causes the
browser client to enter its `onClose` state.

## Verification

The example client is type-checked by the repository lint script:

```sh
npm run example:typecheck
```
