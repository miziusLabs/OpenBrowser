import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { configPath, getConfiguredBrowser, readConfig, setConfiguredBrowser } from "../src/util/config.js";

const originalHome = process.env.OPENBROWSER_HOME;

function useTempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ob-config-"));
  process.env.OPENBROWSER_HOME = home;
  return home;
}

test.afterEach(() => {
  if (originalHome === undefined) delete process.env.OPENBROWSER_HOME;
  else process.env.OPENBROWSER_HOME = originalHome;
});

test("readConfig returns an empty object when no config exists", () => {
  useTempHome();
  assert.deepEqual(readConfig(), {});
  assert.equal(getConfiguredBrowser(), undefined);
});

test("setConfiguredBrowser persists the default browser", () => {
  const home = useTempHome();
  setConfiguredBrowser("chrome");

  assert.equal(getConfiguredBrowser(), "chrome");
  assert.equal(configPath(), path.join(home, "config.json"));
  assert.deepEqual(JSON.parse(fs.readFileSync(configPath(), "utf8")), { browser: "chrome" });
});

test("setConfiguredBrowser preserves unrelated config keys", () => {
  useTempHome();
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), JSON.stringify({ other: 1 }), "utf8");

  setConfiguredBrowser("zen");
  assert.deepEqual(readConfig(), { other: 1, browser: "zen" });
});

test("getConfiguredBrowser ignores malformed config files", () => {
  useTempHome();
  fs.mkdirSync(path.dirname(configPath()), { recursive: true });
  fs.writeFileSync(configPath(), "not json", "utf8");

  assert.deepEqual(readConfig(), {});
  assert.equal(getConfiguredBrowser(), undefined);
});
