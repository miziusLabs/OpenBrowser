import { ZenBrowserAdapter } from "./zen.js";
import { ChromeBrowserAdapter } from "./chrome.js";
import { DEFAULT_BROWSER } from "../constants.js";

const adapters = new Map([
  ["zen", new ZenBrowserAdapter()],
  ["chrome", new ChromeBrowserAdapter()],
]);

export function supportedBrowsers() {
  return [...adapters.keys()];
}

export function resolveBrowser(browser) {
  const name = (browser || DEFAULT_BROWSER).toLowerCase();
  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Unsupported browser: ${browser}. Supported browsers: ${supportedBrowsers().join(", ")}.`);
  }
  return adapter;
}
