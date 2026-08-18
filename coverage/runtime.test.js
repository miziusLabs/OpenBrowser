import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCli } from "../src/cli.js";
import { EXTENSION_ID } from "../src/constants.js";
import { FirefoxFamilyAdapter } from "../src/browsers/firefox-family.js";
import { resolveBrowser } from "../src/browsers/registry.js";
import { selectBrowser } from "../src/browsers/selection.js";
import { installNativeHost, launchBrowser, nativeMessagingManifestPath } from "../src/browsers/shared.js";
import { setConfiguredBrowser } from "../src/util/config.js";

const originalHome = process.env.OPENBROWSER_HOME;
const originalBrowser = process.env.OPENBROWSER_BROWSER;

test.afterEach(() => {
  if (originalHome === undefined) delete process.env.OPENBROWSER_HOME;
  else process.env.OPENBROWSER_HOME = originalHome;
  if (originalBrowser === undefined) delete process.env.OPENBROWSER_BROWSER;
  else process.env.OPENBROWSER_BROWSER = originalBrowser;
});

function useTempHome() {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "ob-runtime-"));
  process.env.OPENBROWSER_HOME = home;
  return home;
}

test("browsers rejects unexpected positional arguments", async () => {
  await assert.rejects(
    () => runCli(["browsers", "chorme"]),
    /Usage: OpenBrowser browsers \[--json\]/,
  );
});

test("Windows Chromium native manifests are browser-specific", () => {
  assert.equal(path.basename(nativeMessagingManifestPath("chrome", "win32")), "openbrowser-chrome.json");
  assert.equal(path.basename(nativeMessagingManifestPath("helium", "win32")), "openbrowser-helium.json");
});

test("launchBrowser waits for wrapper command exit status", async () => {
  const failed = await launchBrowser([{
    command: process.execPath,
    args: ["-e", "process.exit(7)"],
    waitForExit: true,
  }]);
  assert.equal(failed, false);

  const succeeded = await launchBrowser([{
    command: process.execPath,
    args: ["-e", "process.exit(0)"],
    waitForExit: true,
  }]);
  assert.equal(succeeded, true);
});

test("Firefox targets are configured only with host, manifest, and extension", () => {
  const home = useTempHome();
  const profileRoot = path.join(home, "firefox");
  const profile = path.join(profileRoot, "Profiles", "default");
  const manifestRoot = path.join(home, "firefox-manifests");
  const manifestDirectory = process.platform === "linux" ? "native-messaging-hosts" : "NativeMessagingHosts";
  fs.mkdirSync(profile, { recursive: true });
  fs.writeFileSync(path.join(profileRoot, "profiles.ini"), "[Profile0]\nName=Default\nIsRelative=1\nPath=Profiles/default\nDefault=1\n");
  fs.mkdirSync(path.join(manifestRoot, manifestDirectory), { recursive: true });
  fs.writeFileSync(path.join(manifestRoot, manifestDirectory, "openbrowser.json"), "{}\n");

  const adapter = new FirefoxFamilyAdapter({
    name: "test-firefox",
    displayName: "Test Firefox",
    profileRoots: [profileRoot],
    nativeManifestRoots: [manifestRoot],
    launchCommands: [],
  });
  installNativeHost(adapter.name);

  assert.equal(adapter.detect().configured, false);
  fs.mkdirSync(path.join(profile, "extensions"), { recursive: true });
  fs.writeFileSync(path.join(profile, "extensions", `${EXTENSION_ID}.xpi`), "test");
  assert.equal(adapter.detect().configured, true);
});

test("a configured default skips full bridge discovery", async () => {
  useTempHome();
  setConfiguredBrowser("helium");
  const adapter = resolveBrowser("helium");
  const originalDetect = adapter.detect;
  let detectCalls = 0;
  adapter.detect = () => {
    detectCalls += 1;
    return { configured: true };
  };

  try {
    assert.equal((await selectBrowser()).name, "helium");
    assert.equal(detectCalls, 1);
  } finally {
    adapter.detect = originalDetect;
  }
});
