import test from "node:test";
import assert from "node:assert/strict";
import { resolveBrowser, supportedBrowsers } from "../src/browsers/registry.js";


test("supportedBrowsers lists zen and chrome", () => {
  assert.deepEqual(supportedBrowsers(), ["zen", "chrome"]);
});

test("resolveBrowser uses zen by default", () => {
  const adapter = resolveBrowser();
  assert.equal(adapter.name, "zen");
  assert.equal(adapter.displayName, "Zen");
});

test("resolveBrowser resolves chrome", () => {
  const adapter = resolveBrowser("chrome");
  assert.equal(adapter.name, "chrome");
  assert.equal(adapter.displayName, "Chrome");
});

test("resolveBrowser is case-insensitive", () => {
  assert.equal(resolveBrowser("Chrome").name, "chrome");
});

test("resolveBrowser rejects unsupported browsers", () => {
  assert.throws(
    () => resolveBrowser("unknown"),
    /Unsupported browser: unknown\. Supported browsers: zen, chrome\./,
  );
});
