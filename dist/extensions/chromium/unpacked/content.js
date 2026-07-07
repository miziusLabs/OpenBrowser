(function installOpenBrowserContentScript() {
  // Firefox exposes the promise-based `browser` namespace; Chromium only exposes
  // `chrome`. Alias it so the same content script runs on both browser families.
  if (typeof browser === "undefined") var browser = chrome;

  if (window.__openbrowserContentInstalled) return;
  window.__openbrowserContentInstalled = true;

  var refs = new Map();
  var generation = 0;

  var observer = new MutationObserver(function () {
    invalidateReferences();
  });

  observer.observe(document.documentElement || document, {
    childList: true,
    subtree: true,
    attributes: true,
    characterData: true,
    attributeFilter: ["href", "disabled", "aria-label", "aria-hidden", "role", "tabindex", "value"],
  });

  window.addEventListener("pageshow", invalidateReferences, true);
  window.addEventListener("hashchange", invalidateReferences, true);

  browser.runtime.onMessage.addListener(function (message) {
    if (!message || !message.type) return undefined;

    try {
      switch (message.type) {
        case "ping": return Promise.resolve({ ok: true });
        case "state": return Promise.resolve(getState());
        case "click": return Promise.resolve(clickRef(message.ref));
        case "keys": return Promise.resolve(typeKeys(message.text || ""));
        case "press": return Promise.resolve(pressKey(message.key));
        case "select": return Promise.resolve(selectOption(message.ref, message.option));
        case "getHtml": return Promise.resolve(getHtml(message.ref));
        case "scroll": return Promise.resolve(scrollPage(message));
        case "historyBack": history.back(); return Promise.resolve({ ok: true });
        case "historyForward": history.forward(); return Promise.resolve({ ok: true });
        default: return Promise.reject(codedError("UNKNOWN_CONTENT_COMMAND", "Unknown content command."));
      }
    } catch (error) {
      return Promise.reject(error);
    }
  });

  function invalidateReferences() {
    generation += 1;
    refs.clear();
  }

  function getState() {
    refs.clear();
    var elements = collectActionableElements();
    var stateGeneration = generation;
    var result = [];

    elements.forEach(function (element, index) {
      var ref = "e_" + (index + 1);
      refs.set(ref, { element: element, generation: stateGeneration });
      result.push({
        ref: ref,
        role: roleOf(element),
        name: accessibleName(element),
      });
    });

    return {
      url: location.href,
      title: document.title,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        devicePixelRatio: window.devicePixelRatio,
      },
      elements: result,
    };
  }

  function collectActionableElements() {
    var selector = [
      "a[href]",
      "button",
      "input:not([type=hidden])",
      "select",
      "textarea",
      "summary",
      "[role=button]",
      "[role=link]",
      "[role=menuitem]",
      "[role=checkbox]",
      "[role=radio]",
      "[tabindex]",
      "[contenteditable=true]",
    ].join(",");

    return Array.prototype.slice.call(document.querySelectorAll(selector))
      .filter(function (element) {
        return isVisible(element) && !isDisabled(element) && accessibleName(element);
      })
      .slice(0, 200);
  }

  function getRef(ref) {
    var entry = refs.get(ref);
    if (!entry || entry.generation !== generation || !entry.element.isConnected) {
      throw codedError("STALE_REFERENCE", "Stale OpenBrowser reference. Run state again and use a fresh ref.");
    }
    return entry.element;
  }

  function clickRef(ref) {
    var element = getRef(ref);
    element.scrollIntoView({ block: "center", inline: "center" });
    element.focus({ preventScroll: true });
    dispatchMouse(element, "mouseover");
    dispatchMouse(element, "mousedown");
    dispatchMouse(element, "mouseup");
    if (typeof element.click === "function") element.click();
    else dispatchMouse(element, "click");
    return { ok: true };
  }

  function typeKeys(text) {
    var element = document.activeElement;
    if (!element || element === document.body) throw codedError("NO_FOCUS", "No focused element is available for text input.");

    if (isTextInput(element)) {
      insertText(element, text);
      return { ok: true };
    }

    if (element.isContentEditable) {
      document.execCommand("insertText", false, text);
      element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
      return { ok: true };
    }

    throw codedError("NOT_EDITABLE", "The focused element does not accept text input.");
  }

  function pressKey(key) {
    var element = document.activeElement || document.body;
    var options = { key: key, bubbles: true, cancelable: true };
    element.dispatchEvent(new KeyboardEvent("keydown", options));
    element.dispatchEvent(new KeyboardEvent("keypress", options));

    if (key === "Enter" && typeof element.click === "function" && /^(BUTTON|A)$/.test(element.tagName)) element.click();
    if (key === "Tab") focusNextElement();

    element.dispatchEvent(new KeyboardEvent("keyup", options));
    return { ok: true };
  }

  function selectOption(ref, option) {
    var element = getRef(ref);
    if (element.tagName !== "SELECT") throw codedError("NOT_SELECT", "Referenced element is not a select control.");

    var options = Array.prototype.slice.call(element.options);
    var match = options.find(function (candidate, index) {
      return candidate.value === option || candidate.text.trim() === option || String(index) === option;
    });
    if (!match) throw codedError("OPTION_NOT_FOUND", "Select option was not found.");

    element.value = match.value;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true };
  }

  function getHtml(ref) {
    if (!ref) return { html: document.documentElement.outerHTML };
    return { html: getRef(ref).outerHTML };
  }

  function scrollPage(message) {
    if (message.to) {
      getRef(message.to).scrollIntoView({ block: "center", inline: "nearest" });
      return { ok: true, scrollX: window.scrollX, scrollY: window.scrollY };
    }

    var pixels = Number(message.pixels || 600);
    if (!Number.isFinite(pixels) || pixels <= 0) pixels = 600;
    window.scrollBy({ top: message.direction === "up" ? -pixels : pixels, left: 0, behavior: "auto" });
    return { ok: true, scrollX: window.scrollX, scrollY: window.scrollY };
  }

  function accessibleName(element) {
    return (
      element.getAttribute("aria-label") ||
      element.getAttribute("title") ||
      element.getAttribute("alt") ||
      associatedLabel(element) ||
      element.value ||
      element.textContent ||
      element.getAttribute("placeholder") ||
      ""
    ).replace(/\s+/g, " ").trim().slice(0, 160);
  }

  function associatedLabel(element) {
    if (element.id) {
      var label = document.querySelector('label[for="' + cssEscape(element.id) + '"]');
      if (label) return label.textContent;
    }
    var parent = element.closest("label");
    return parent ? parent.textContent : "";
  }

  function roleOf(element) {
    var explicit = element.getAttribute("role");
    if (explicit) return explicit;
    var tag = element.tagName.toLowerCase();
    if (tag === "a") return "link";
    if (tag === "button") return "button";
    if (tag === "select") return "select";
    if (tag === "textarea") return "textbox";
    if (tag === "summary") return "button";
    if (tag === "input") {
      var type = (element.getAttribute("type") || "text").toLowerCase();
      if (["button", "submit", "reset"].includes(type)) return "button";
      if (["checkbox", "radio"].includes(type)) return type;
      return "textbox";
    }
    return "control";
  }

  function isVisible(element) {
    var style = getComputedStyle(element);
    if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity) === 0) return false;
    var rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function isDisabled(element) {
    return Boolean(element.disabled || element.getAttribute("aria-disabled") === "true");
  }

  function dispatchMouse(element, type) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window }));
  }

  function isTextInput(element) {
    return element.tagName === "TEXTAREA" || (element.tagName === "INPUT" && !["button", "checkbox", "file", "radio", "reset", "submit"].includes((element.type || "text").toLowerCase()));
  }

  function insertText(element, text) {
    var start = element.selectionStart || 0;
    var end = element.selectionEnd || start;
    var value = element.value || "";
    element.value = value.slice(0, start) + text + value.slice(end);
    var cursor = start + text.length;
    element.setSelectionRange(cursor, cursor);
    element.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: text }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function focusNextElement() {
    var focusable = collectActionableElements();
    var index = focusable.indexOf(document.activeElement);
    var next = focusable[(index + 1) % focusable.length];
    if (next) next.focus();
  }

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/"/g, '\\"');
  }

  function codedError(code, message) {
    var error = new Error(message);
    error.code = code;
    return error;
  }
})();
