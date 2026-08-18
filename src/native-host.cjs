#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("node:fs");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");

const browser = process.env.OPENBROWSER_BROWSER;
if (!browser) {
  process.stderr.write("OpenBrowser native host was started without a browser target.\n");
  process.exit(1);
}
const appHome = process.env.OPENBROWSER_HOME || path.join(os.homedir(), "OpenBrowser");
const socketPath = process.platform === "win32"
  ? `\\\\.\\pipe\\openbrowser-${browser}`
  : path.join(appHome, "bridge", `${browser}.sock`);

const pending = new Map();
let nextId = 1;
let server;

function log(message) {
  console.error(`[OpenBrowser native host] ${message}`);
}

function nativeWrite(message) {
  const json = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(json.length, 0);
  process.stdout.write(Buffer.concat([header, json]));
}

function respond(socket, response) {
  socket.end(`${JSON.stringify(response)}\n`);
}

function forwardToExtension(payload) {
  return new Promise((resolve, reject) => {
    const id = `n_${Date.now()}_${nextId++}`;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error("Timed out waiting for the OpenBrowser extension."));
    }, 30_000);

    pending.set(id, { resolve, reject, timer });
    nativeWrite({ id, ...payload });
  });
}

function handleNativeMessage(message) {
  if (!message || typeof message !== "object") return;
  if (!message.replyTo) return;

  const request = pending.get(message.replyTo);
  if (!request) return;
  pending.delete(message.replyTo);
  clearTimeout(request.timer);

  if (message.ok) request.resolve(message.result);
  else {
    const error = new Error(message.error?.message || "OpenBrowser extension command failed.");
    error.code = message.error?.code;
    request.reject(error);
  }
}

let stdinBuffer = Buffer.alloc(0);
process.stdin.on("data", (chunk) => {
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);

  while (stdinBuffer.length >= 4) {
    const length = stdinBuffer.readUInt32LE(0);
    if (stdinBuffer.length < 4 + length) break;

    const body = stdinBuffer.slice(4, 4 + length);
    stdinBuffer = stdinBuffer.slice(4 + length);

    try {
      handleNativeMessage(JSON.parse(body.toString("utf8")));
    } catch (error) {
      log(`failed to parse extension message: ${error.message}`);
    }
  }
});

process.stdin.on("end", () => {
  shutdown(0);
});

function ensureSocketDirectory() {
  if (process.platform === "win32") return;
  const dir = path.dirname(socketPath);
  fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  try {
    fs.chmodSync(appHome, 0o700);
  } catch {}
  try {
    fs.unlinkSync(socketPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

function startServer() {
  ensureSocketDirectory();

  server = net.createServer((socket) => {
    let buffer = "";
    socket.on("data", async (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      const line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);

      let request;
      try {
        request = JSON.parse(line);
      } catch {
        respond(socket, { ok: false, error: { code: "BAD_REQUEST", message: "Invalid OpenBrowser request." } });
        return;
      }

      try {
        const result = await forwardToExtension(request);
        respond(socket, { ok: true, result });
      } catch (error) {
        respond(socket, {
          ok: false,
          error: { code: error.code || "COMMAND_FAILED", message: error.message || String(error) },
        });
      }
    });
  });

  server.listen(socketPath, () => {
    if (process.platform !== "win32") {
      try { fs.chmodSync(socketPath, 0o600); } catch {}
    }
    log(`listening on ${socketPath}`);
  });

  server.on("error", (error) => {
    log(error.message);
    shutdown(1);
  });
}

function shutdown(code) {
  for (const [id, request] of pending) {
    clearTimeout(request.timer);
    request.reject(new Error("OpenBrowser native host stopped."));
    pending.delete(id);
  }

  if (server) server.close();
  if (process.platform !== "win32") {
    try { fs.unlinkSync(socketPath); } catch {}
  }
  process.exit(code);
}

process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));

startServer();
