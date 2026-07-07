// Firefox exposes the promise-based `browser` namespace; Chromium only exposes
// `chrome`. Prefer `browser` and fall back to `chrome` so the same background
// script runs on both browser families.
const browser = globalThis.browser || globalThis.chrome;

const NATIVE_HOST = "openbrowser";
const SESSION_KEY = "session";
let port;
let reconnectTimer;

connectNativeHost();
browser.tabs.onRemoved.addListener(handleTabRemoved);

function connectNativeHost() {
  try {
    port = browser.runtime.connectNative(NATIVE_HOST);
    port.onMessage.addListener(handleNativeMessage);
    port.onDisconnect.addListener(() => {
      port = null;
      scheduleReconnect();
    });
  } catch (error) {
    scheduleReconnect();
  }
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectNativeHost();
  }, 1000);
}

async function handleNativeMessage(message) {
  const id = message && message.id;
  if (!id) return;

  try {
    const result = await dispatchCommand(message.command, message.args || {});
    postNative({ replyTo: id, ok: true, result });
  } catch (error) {
    postNative({
      replyTo: id,
      ok: false,
      error: {
        code: error.code || "COMMAND_FAILED",
        message: error.message || String(error),
      },
    });
  }
}

function postNative(message) {
  if (!port) return;
  port.postMessage(message);
}

async function dispatchCommand(command, args) {
  switch (command) {
    case "open": return openSession(args.url);
    case "close": return closeSession();
    case "status": return status();
    case "navigate": return navigate(args.url);
    case "reload": return tabAction((tabId) => browser.tabs.reload(tabId));
    case "back": return contentCommand("historyBack", {});
    case "forward": return contentCommand("historyForward", {});
    case "state": return contentCommand("state", {});
    case "screenshot": return screenshot();
    case "click": return contentCommand("click", { ref: args.ref });
    case "keys": return contentCommand("keys", { text: args.text });
    case "press": return contentCommand("press", { key: args.key });
    case "select": return contentCommand("select", { ref: args.ref, option: args.option });
    case "getHtml": return contentCommand("getHtml", { ref: args.ref });
    case "scroll": return contentCommand("scroll", args);
    default: throw codedError("UNKNOWN_COMMAND", `Unknown OpenBrowser command: ${command}`);
  }
}

async function openSession(url) {
  const existing = await getLiveSession();
  if (existing) throw codedError("SESSION_EXISTS", "An OpenBrowser session already exists for this browser. Close it first.");

  const tab = await browser.tabs.create({ url });
  const session = { tabId: tab.id, createdAt: new Date().toISOString() };
  await browser.storage.local.set({ [SESSION_KEY]: session });
  return { ok: true, session, url: tab.url || url };
}

async function closeSession() {
  const session = await getStoredSession();
  if (!session) return { ok: true, open: false };

  try {
    await browser.tabs.remove(session.tabId);
  } catch {
    // The owned tab may already have been manually closed.
  }
  await clearSession();
  return { ok: true, open: false };
}

async function status() {
  const session = await getLiveSession();
  if (!session) return { open: false };
  const tab = await browser.tabs.get(session.tabId);
  return {
    open: true,
    session,
    tab: {
      id: tab.id,
      url: tab.url,
      title: tab.title,
      status: tab.status,
    },
  };
}

async function navigate(url) {
  const session = await requireLiveSession();
  await browser.tabs.update(session.tabId, { url });
  return { ok: true };
}

async function tabAction(action) {
  const session = await requireLiveSession();
  await action(session.tabId);
  return { ok: true };
}

async function screenshot() {
  const session = await requireLiveSession();
  await browser.tabs.update(session.tabId, { active: true });

  // Firefox supports per-tab captureTab; Chromium only captures the visible tab.
  if (typeof browser.tabs.captureTab === "function") {
    return { dataUrl: await browser.tabs.captureTab(session.tabId, { format: "png" }) };
  }

  const tab = await browser.tabs.get(session.tabId);
  const dataUrl = await browser.tabs.captureVisibleTab(tab.windowId, { format: "png" });
  return { dataUrl };
}

async function contentCommand(type, payload) {
  const session = await requireLiveSession();
  await ensureContentScript(session.tabId);
  try {
    return await browser.tabs.sendMessage(session.tabId, { type, ...payload });
  } catch (error) {
    throw codedError("CONTENT_UNAVAILABLE", error.message || "OpenBrowser content script is unavailable on this page.");
  }
}

async function ensureContentScript(tabId) {
  try {
    await browser.tabs.sendMessage(tabId, { type: "ping" });
    return;
  } catch {
    // Inject below.
  }

  try {
    // MV3 (Chromium) exposes scripting.executeScript; MV2 (Firefox) uses tabs.executeScript.
    if (browser.scripting && typeof browser.scripting.executeScript === "function") {
      await browser.scripting.executeScript({ target: { tabId }, files: ["content.js"] });
    } else {
      await browser.tabs.executeScript(tabId, { file: "content.js", runAt: "document_idle" });
    }
  } catch (error) {
    throw codedError("INJECTION_FAILED", `Cannot control this page: ${error.message || error}`);
  }
}

async function getStoredSession() {
  const stored = await browser.storage.local.get(SESSION_KEY);
  return stored[SESSION_KEY] || null;
}

async function getLiveSession() {
  const session = await getStoredSession();
  if (!session) return null;
  try {
    await browser.tabs.get(session.tabId);
    return session;
  } catch {
    await clearSession();
    return null;
  }
}

async function requireLiveSession() {
  const session = await getLiveSession();
  if (!session) throw codedError("NO_SESSION", "No active OpenBrowser session exists for this browser.");
  return session;
}

async function clearSession() {
  await browser.storage.local.remove(SESSION_KEY);
}

async function handleTabRemoved(tabId) {
  const session = await getStoredSession();
  if (session && session.tabId === tabId) await clearSession();
}

function codedError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
