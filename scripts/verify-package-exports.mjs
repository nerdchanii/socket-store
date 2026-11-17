import assert from "node:assert/strict";
import { createRequire } from "node:module";
import * as esm from "socket-store";

const require = createRequire(import.meta.url);
const cjs = require("socket-store");

for (const name of ["SocketStore", "createMessageHandler", "SocketStoreError"]) {
  assert.equal(typeof esm[name], "function", `Missing ESM export: ${name}`);
  assert.equal(typeof cjs[name], "function", `Missing CommonJS export: ${name}`);
}
