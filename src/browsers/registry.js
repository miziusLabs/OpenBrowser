import { browserDefinitions } from "./catalog.js";
import { ChromiumFamilyAdapter } from "./chromium-family.js";
import { FirefoxFamilyAdapter } from "./firefox-family.js";

const adapters = new Map(browserDefinitions().map((definition) => {
  const Adapter = definition.family === "firefox" ? FirefoxFamilyAdapter : ChromiumFamilyAdapter;
  return [definition.name, new Adapter(definition)];
}));

const aliases = new Map();
for (const adapter of adapters.values()) {
  aliases.set(adapter.name, adapter.name);
  for (const alias of adapter.aliases) aliases.set(alias.toLowerCase(), adapter.name);
}

export function supportedBrowsers() {
  return [...adapters.keys()];
}

export function browserAdapters() {
  return [...adapters.values()];
}

export function browserCatalog() {
  return browserAdapters().map((adapter) => ({
    name: adapter.name,
    displayName: adapter.displayName,
    family: adapter.family,
    aliases: [...adapter.aliases],
  }));
}

export function normalizeBrowserName(browser) {
  if (browser === undefined || browser === null) return undefined;
  const normalized = String(browser).trim().toLowerCase();
  return aliases.get(normalized) || normalized;
}

export function resolveBrowser(browser) {
  const name = normalizeBrowserName(browser);
  if (!name || name === "auto") {
    throw new Error(`Browser selection is required. Choose one of: ${supportedBrowsers().join(", ")}.`);
  }

  const adapter = adapters.get(name);
  if (!adapter) {
    throw new Error(`Unsupported browser: ${browser}. Supported browsers: ${supportedBrowsers().join(", ")}.`);
  }
  return adapter;
}
