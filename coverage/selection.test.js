import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { selectBrowser } from "../src/browsers/selection.js";
import { setConfiguredBrowser } from "../src/util/config.js";

const originalHome = process.env.OPENBROWSER_HOME;
const originalBrowser = process.env.OPENBROWSER_BROWSER;

function useTempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ob-selection-"));
  process.env.OPENBROWSER_HOME = home;
  return home;
}

test.afterEach(() => {
  if (originalHome === undefined) delete process.env.OPENBROWSER_HOME;
  else process.env.OPENBROWSER_HOME = originalHome;
  if (originalBrowser === undefined) delete process.env.OPENBROWSER_BROWSER;
  else process.env.OPENBROWSER_BROWSER = originalBrowser;
});

test("explicit browser selection resolves aliases without discovery", async () => {
  const adapter = await selectBrowser("Google Chrome");
  assert.equal(adapter.name, "chrome");
});

test("an unconfigured local default produces a setup instruction", async () => {
  useTempHome();
  setConfiguredBrowser("helium");

  await assert.rejects(
    () => selectBrowser(),
    /Selected browser Helium is not set up\. Run OpenBrowser setup helium\./,
  );
});

test("an active session is used when the configured browser is not set up", async () => {
  const home = useTempHome();
  setConfiguredBrowser("helium");
  const socketPath = path.join(home, "bridge", "chrome.sock");
  fs.mkdirSync(path.dirname(socketPath), { recursive: true });
  const server = net.createServer((socket) => {
    socket.on("data", () => {
      socket.end(JSON.stringify({ ok: true, result: { open: true, session: { tabId: 7 } } }) + "\n");
    });
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve);
  });

  try {
    const adapter = await selectBrowser();
    assert.equal(adapter.name, "chrome");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("OPENBROWSER_BROWSER overrides the configured browser", async () => {
  useTempHome();
  setConfiguredBrowser("zen");
  process.env.OPENBROWSER_BROWSER = "chrome";

  const adapter = await selectBrowser();
  assert.equal(adapter.name, "chrome");
});
