import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ChromeBrowserAdapter } from "../src/browsers/chrome.js";
import { ChromiumFamilyAdapter } from "../src/browsers/chromium-family.js";
import { HeliumBrowserAdapter } from "../src/browsers/helium.js";
import { browserDefinitions } from "../src/browsers/catalog.js";
import { CHROMIUM_EXTENSION_ID, CHROMIUM_EXTENSION_KEY, NATIVE_HOST_NAME } from "../src/constants.js";

const originalHome = process.env.OPENBROWSER_HOME;

test.afterEach(() => {
  if (originalHome === undefined) delete process.env.OPENBROWSER_HOME;
  else process.env.OPENBROWSER_HOME = originalHome;
});

test("ChromeBrowserAdapter identifies as chrome", () => {
  const adapter = new ChromeBrowserAdapter();
  assert.equal(adapter.name, "chrome");
  assert.equal(adapter.displayName, "Chrome");
});

test("HeliumBrowserAdapter reuses the Chromium family", () => {
  const adapter = new HeliumBrowserAdapter();
  assert.equal(adapter.name, "helium");
  assert.equal(adapter.displayName, "Helium");
  assert.equal(adapter.family, "chromium");
});

test("Helium uses the standard Windows installer layout", () => {
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const helium = browserDefinitions("win32").find((definition) => definition.name === "helium");
  const applicationPath = path.join(localAppData, "imput", "Helium", "Application", "chrome.exe");
  const profilePath = path.join(localAppData, "imput", "Helium", "User Data");

  assert.ok(helium.profileRoots.includes(profilePath));
  assert.ok(helium.applicationPaths.includes(applicationPath));
  assert.ok(helium.launchCommands.some(({ command }) => command === applicationPath));
  assert.deepEqual(helium.registryRoots, ["HKCU\\Software\\Chromium\\NativeMessagingHosts"]);
});

test("CHROMIUM_EXTENSION_ID is derived from CHROMIUM_EXTENSION_KEY", () => {
  const der = Buffer.from(CHROMIUM_EXTENSION_KEY, "base64");
  const hex = crypto.createHash("sha256").update(der).digest().subarray(0, 16).toString("hex");
  const id = [...hex].map((nibble) => String.fromCharCode(97 + parseInt(nibble, 16))).join("");
  assert.equal(id, CHROMIUM_EXTENSION_ID);
});

test("install stages the extension and writes a Chromium native-messaging manifest", { skip: process.platform === "win32" }, async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ob-chrome-"));
  const manifestRoot = fs.mkdtempSync(path.join(os.tmpdir(), "ob-chrome-root-"));
  process.env.OPENBROWSER_HOME = home;

  const adapter = new ChromiumFamilyAdapter({
    name: "chrome",
    displayName: "Chrome",
    nativeManifestRoots: [manifestRoot],
    registryRoots: [],
    launchCommands: [],
  });

  try {
    const result = await adapter.install();

    // Native host launcher exists and is executable.
    assert.ok(fs.existsSync(result.nativeHost));

    // Extension is staged as an unpacked directory the user can load.
    assert.equal(result.unpackedExtension, path.join(home, "extensions", "chrome"));
    assert.ok(fs.existsSync(path.join(result.unpackedExtension, "manifest.json")));
    assert.ok(fs.existsSync(path.join(result.unpackedExtension, "background.js")));
    assert.ok(fs.existsSync(path.join(result.unpackedExtension, "assets", "logo-128.png")));
    const extensionManifest = JSON.parse(fs.readFileSync(path.join(result.unpackedExtension, "manifest.json"), "utf8"));
    assert.equal(extensionManifest.icons["128"], "assets/logo-128.png");

    // Native-messaging manifest uses the Chromium allowed_origins format.
    const manifestPath = path.join(manifestRoot, "NativeMessagingHosts", `${NATIVE_HOST_NAME}.json`);
    assert.deepEqual(result.nativeManifests, [manifestPath]);
    const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
    assert.equal(manifest.name, NATIVE_HOST_NAME);
    assert.equal(manifest.type, "stdio");
    assert.equal(manifest.path, result.nativeHost);
    assert.deepEqual(manifest.allowed_origins, [`chrome-extension://${CHROMIUM_EXTENSION_ID}/`]);
  } finally {
    fs.rmSync(home, { recursive: true, force: true });
    fs.rmSync(manifestRoot, { recursive: true, force: true });
  }
});
