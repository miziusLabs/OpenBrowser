import test from "node:test";
import assert from "node:assert/strict";
import { normalizeBrowserName, resolveBrowser, supportedBrowsers } from "../src/browsers/registry.js";


test("supportedBrowsers lists the registered browser targets", () => {
  assert.deepEqual(supportedBrowsers(), ["zen", "chrome", "helium"]);
});

test("resolveBrowser resolves Zen", () => {
  const adapter = resolveBrowser("zen");
  assert.equal(adapter.name, "zen");
  assert.equal(adapter.displayName, "Zen");
});

test("resolveBrowser resolves Chrome", () => {
  const adapter = resolveBrowser("chrome");
  assert.equal(adapter.name, "chrome");
  assert.equal(adapter.displayName, "Chrome");
});

test("resolveBrowser resolves Helium through the Chromium family", () => {
  const adapter = resolveBrowser("helium");
  assert.equal(adapter.name, "helium");
  assert.equal(adapter.family, "chromium");
});

test("resolveBrowser accepts case-insensitive aliases", () => {
  assert.equal(resolveBrowser("Google Chrome").name, "chrome");
  assert.equal(resolveBrowser("HELIUM-BROWSER").name, "helium");
  assert.equal(normalizeBrowserName("Zen Browser"), "zen");
  assert.equal(normalizeBrowserName("zen-browser"), "zen");
});

test("resolveBrowser does not silently select a default", () => {
  assert.throws(
    () => resolveBrowser(),
    /Browser selection is required\. Choose one of: zen, chrome, helium\./,
  );
});

test("resolveBrowser rejects automatic selection as a concrete browser", () => {
  assert.throws(
    () => resolveBrowser("auto"),
    /Browser selection is required\. Choose one of: zen, chrome, helium\./,
  );
});

test("resolveBrowser rejects unsupported browsers", () => {
  assert.throws(
    () => resolveBrowser("unknown"),
    /Unsupported browser: unknown\. Supported browsers: zen, chrome, helium\./,
  );
});
