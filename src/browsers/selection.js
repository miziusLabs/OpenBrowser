import { sendBridgeCommand } from "../bridge/client.js";
import { DEFAULT_BROWSER } from "../constants.js";
import { getConfiguredBrowser } from "../util/config.js";
import { browserAdapters, normalizeBrowserName, resolveBrowser } from "./registry.js";

const PROBE_TIMEOUT_MS = 800;

export async function selectBrowser(requested, options = {}) {
  const { allowUnconfigured = false } = options;

  if (requested !== undefined) {
    const normalized = normalizeBrowserName(requested);
    if (normalized !== DEFAULT_BROWSER) return resolveBrowser(requested);
    return selectAutomatically(undefined, allowUnconfigured);
  }

  const environmentBrowser = process.env.OPENBROWSER_BROWSER;
  if (environmentBrowser) {
    const normalized = normalizeBrowserName(environmentBrowser);
    if (normalized !== DEFAULT_BROWSER) return resolveBrowser(environmentBrowser);
    return selectAutomatically(undefined, allowUnconfigured);
  }

  const configuredBrowser = getConfiguredBrowser();
  if (configuredBrowser) {
    const normalized = normalizeBrowserName(configuredBrowser);
    if (normalized !== DEFAULT_BROWSER) return selectAutomatically(resolveBrowser(configuredBrowser), allowUnconfigured);
  }

  return selectAutomatically(undefined, allowUnconfigured);
}

export async function inspectBrowsers() {
  return Promise.all(browserAdapters().map(async (adapter) => {
    const detected = adapter.detect();
    let bridgeResponding = false;
    let sessionOpen = false;
    let session;

    try {
      const status = await sendBridgeCommand(adapter.name, "status", {}, { timeoutMs: PROBE_TIMEOUT_MS });
      bridgeResponding = true;
      sessionOpen = Boolean(status?.open);
      session = status?.session;
    } catch {
      // A browser without a running native bridge is still useful discovery data.
    }

    return {
      ...detected,
      ready: bridgeResponding,
      sessionOpen,
      session,
      bridgeSocket: detected.bridgeSocket || bridgeResponding,
    };
  }));
}

async function selectAutomatically(preferred, allowUnconfigured) {
  const inventory = await inspectBrowsers();
  const active = inventory.filter((browser) => browser.sessionOpen);
  if (active.length === 1) return resolveBrowser(active[0].browser);
  if (active.length > 1) {
    throw new Error(`Multiple active OpenBrowser sessions found: ${formatBrowsers(active)}. Pass --browser or run OpenBrowser use <browser>.`);
  }

  if (preferred) {
    const preferredStatus = inventory.find((browser) => browser.browser === preferred.name);
    if (!allowUnconfigured && preferredStatus && !preferredStatus.configured && !preferredStatus.ready) {
      throw new Error(`Selected browser ${preferred.displayName} is not set up. Run OpenBrowser setup ${preferred.name}.`);
    }
    return preferred;
  }

  const responsive = inventory.filter((browser) => browser.ready);
  if (responsive.length === 1) return resolveBrowser(responsive[0].browser);
  if (responsive.length > 1) {
    throw new Error(`Multiple browsers are ready: ${formatBrowsers(responsive)}. Pass --browser or run OpenBrowser use <browser>.`);
  }

  const configured = inventory.filter((browser) => browser.configured);
  if (configured.length === 1) return resolveBrowser(configured[0].browser);
  if (configured.length > 1) {
    throw new Error(`Multiple browsers are configured: ${formatBrowsers(configured)}. Run OpenBrowser use <browser> to choose one.`);
  }

  const installed = inventory.filter((browser) => browser.installed);
  if (installed.length === 1) {
    if (!installed[0].configured && !allowUnconfigured) {
      throw new Error(`Detected ${installed[0].displayName}, but it is not set up. Run OpenBrowser setup ${installed[0].browser}.`);
    }
    return resolveBrowser(installed[0].browser);
  }
  if (installed.length > 1) {
    throw new Error(`Multiple supported browsers were detected: ${formatBrowsers(installed)}. Run OpenBrowser setup <browser> or OpenBrowser use <browser>.`);
  }

  throw new Error("No supported browser was detected. Run OpenBrowser browsers to inspect the setup, then OpenBrowser setup <browser>.");
}

function formatBrowsers(browsers) {
  return browsers.map((browser) => `${browser.displayName} (${browser.browser})`).join(", ");
}
