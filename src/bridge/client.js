import net from "node:net";
import { bridgeSocketPath } from "../util/paths.js";

export class BridgeUnavailableError extends Error {
  constructor(browser, cause) {
    super(
      `OpenBrowser bridge for ${browser} is not available. Run OpenBrowser setup ${browser}, load the extension if prompted, then retry.`,
    );
    this.name = "BridgeUnavailableError";
    this.cause = cause;
  }
}

export function sendBridgeCommand(browser, command, args = {}, options = {}) {
  const socketPath = bridgeSocketPath(browser);
  const timeoutMs = options.timeoutMs ?? 30_000;

  return new Promise((resolve, reject) => {
    const socket = net.createConnection(socketPath);
    let settled = false;
    let buffer = "";

    const timer = setTimeout(() => {
      finish(new Error(`Timed out waiting for ${browser} to complete ${command}.`));
      socket.destroy();
    }, timeoutMs);

    function finish(error, value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(value);
    }

    socket.on("connect", () => {
      socket.write(`${JSON.stringify({ command, args })}\n`);
    });

    socket.on("data", (chunk) => {
      buffer += chunk.toString("utf8");
      const newline = buffer.indexOf("\n");
      if (newline === -1) return;
      const line = buffer.slice(0, newline);
      socket.end();

      try {
        const response = JSON.parse(line);
        if (!response.ok) {
          const error = new Error(response.error?.message || "OpenBrowser command failed.");
          error.code = response.error?.code;
          finish(error);
          return;
        }
        finish(null, response.result);
      } catch (error) {
        finish(error);
      }
    });

    socket.on("error", (error) => {
      if (error.code === "ENOENT" || error.code === "ECONNREFUSED") {
        finish(new BridgeUnavailableError(browser, error));
        return;
      }
      finish(error);
    });
  });
}

export async function sendBridgeCommandWithRetry(browser, command, args = {}, options = {}) {
  const attempts = options.attempts ?? 1;
  const delayMs = options.delayMs ?? 500;
  let lastError;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await sendBridgeCommand(browser, command, args, options);
    } catch (error) {
      lastError = error;
      if (!(error instanceof BridgeUnavailableError) || attempt === attempts - 1) break;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw lastError;
}
