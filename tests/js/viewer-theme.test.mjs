import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "vitest";
import path from "node:path";
import vm from "node:vm";

const ROOT = process.cwd();
const THEME_SOURCE = fs.readFileSync(path.join(ROOT, "viewer", "theme.js"), "utf8");
const AVNAV_TOKENS = {
  "--avnav-fore-color": "rgb(1, 2, 3)",
  "--avnav-back-color": "rgb(4, 5, 6)",
  "--avnav-main-color": "rgb(7, 8, 9)",
  "--avnav-second-color": "rgb(10, 11, 12)",
  "--avnav-attention-color": "rgb(13, 14, 15)",
  "--avnav-active-color": "rgb(16, 17, 18)",
  "--avnav-border-color": "rgb(19, 20, 21)",
  "--avnav-widget-head-color": "rgb(22, 23, 24)"
};

/** @typedef {{fontFamily: string, nightMode: boolean, tokens: Record<string, string>}} ParentDocumentOptions */
/**
 * @typedef {{
 *   body: object,
 *   defaultView: {getComputedStyle: (element: object) => {fontFamily: string, getPropertyValue: (name: string) => string}},
 *   documentElement: object,
 *   querySelector: (selector: string) => object | null
 * }} FakeParentDocument
 */
/**
 * @typedef {{
 *   get: (name: string) => string | undefined,
 *   has: (name: string) => boolean,
 *   removeProperty: (name: string) => void,
 *   setProperty: (name: string, value: string) => void
 * }} FakeStyleBag
 */
/** @typedef {{contains: (name: string) => boolean, toggle: (name: string, enabled: boolean) => void}} FakeClassList */
/** @typedef {{Polarrecorder: object, setInterval: () => void, parent?: any}} FakeWindow */

test("copies AvNav tokens and font", () => {
  const parentDocument = makeParentDocument({
    fontFamily: "Verdana, Arial, sans-serif",
    nightMode: true,
    tokens: AVNAV_TOKENS
  });
  const env = loadTheme(parentDocument);

  env.fireDOMContentLoaded();

  assert.equal(env.classList.contains("nightMode"), true);
  assert.equal(env.style.get("--polarrecorder-fore-color"), AVNAV_TOKENS["--avnav-fore-color"]);
  assert.equal(env.style.get("--polarrecorder-back-color"), AVNAV_TOKENS["--avnav-back-color"]);
  assert.equal(env.style.get("--polarrecorder-main-color"), AVNAV_TOKENS["--avnav-main-color"]);
  assert.equal(env.style.get("--polarrecorder-second-color"), AVNAV_TOKENS["--avnav-second-color"]);
  assert.equal(env.style.get("--polarrecorder-attention-color"), AVNAV_TOKENS["--avnav-attention-color"]);
  assert.equal(env.style.get("--polarrecorder-active-color"), AVNAV_TOKENS["--avnav-active-color"]);
  assert.equal(env.style.get("--polarrecorder-border-color"), AVNAV_TOKENS["--avnav-border-color"]);
  assert.equal(env.style.get("--polarrecorder-widget-head-color"), AVNAV_TOKENS["--avnav-widget-head-color"]);
  assert.equal(env.style.get("--polarrecorder-surface-color"), AVNAV_TOKENS["--avnav-back-color"]);
  assert.equal(env.style.get("--polarrecorder-surface-variant"), AVNAV_TOKENS["--avnav-second-color"]);
  assert.equal(env.style.get("--polarrecorder-accepted-color"), AVNAV_TOKENS["--avnav-active-color"]);
  assert.equal(env.style.get("--polarrecorder-rejected-color"), AVNAV_TOKENS["--avnav-attention-color"]);
  assert.equal(env.style.has("--polarrecorder-quarantined-color"), false);
  assert.equal(env.style.get("--polarrecorder-font-stack"), "Verdana, Arial, sans-serif");
});

test("clears overrides when standalone", () => {
  const env = loadTheme(
    makeParentDocument({
      fontFamily: "Verdana, Arial, sans-serif",
      nightMode: false,
      tokens: AVNAV_TOKENS
    })
  );

  env.fireDOMContentLoaded();
  env.setStandalone();
  env.fireDOMContentLoaded();

  assert.equal(env.classList.contains("nightMode"), false);
  assert.equal(env.style.has("--polarrecorder-main-color"), false);
  assert.equal(env.style.has("--polarrecorder-font-stack"), false);
});

test("a cross-origin parent falls back cleanly", () => {
  const env = loadTheme(
    makeParentDocument({
      fontFamily: "Verdana, Arial, sans-serif",
      nightMode: true,
      tokens: AVNAV_TOKENS
    })
  );
  const throwingParent = {};
  Object.defineProperty(throwingParent, "document", {
    get() {
      throw new Error("blocked");
    }
  });

  env.fireDOMContentLoaded();
  env.window.parent = throwingParent;
  env.fireDOMContentLoaded();

  assert.equal(env.classList.contains("nightMode"), false);
  assert.equal(env.style.has("--polarrecorder-main-color"), false);
});

/** @param {FakeParentDocument} parentDocument */
function loadTheme(parentDocument) {
  /** @type {Map<string, () => void>} */
  const listeners = new Map();
  const style = makeStyleBag();
  const classList = makeClassList();
  /** @type {FakeWindow} */
  const localWindow = {
    Polarrecorder: {},
    setInterval() {}
  };
  const localDocument = {
    addEventListener(/** @type {string} */ name, /** @type {() => void} */ callback) {
      listeners.set(name, callback);
    },
    body: { classList, style },
    documentElement: {}
  };

  localWindow.parent = { document: parentDocument };
  vm.runInNewContext(
    THEME_SOURCE,
    { document: localDocument, window: localWindow },
    {
      filename: path.join(ROOT, "viewer", "theme.js")
    }
  );

  return {
    classList,
    fireDOMContentLoaded() {
      const listener = listeners.get("DOMContentLoaded");
      if (!listener) throw new Error("DOMContentLoaded listener was not registered");
      listener();
    },
    setStandalone() {
      localWindow.parent = localWindow;
    },
    style,
    window: localWindow
  };
}

/**
 * @param {ParentDocumentOptions} options
 * @returns {FakeParentDocument}
 */
function makeParentDocument(options) {
  const body = {};
  const documentElement = {};
  const nightElement = {};
  return {
    body,
    defaultView: {
      getComputedStyle(element) {
        return {
          fontFamily: element === body ? options.fontFamily : "",
          getPropertyValue(/** @type {string} */ name) {
            return options.tokens[name] || "";
          }
        };
      }
    },
    documentElement,
    querySelector(selector) {
      if (selector === ".nightMode" && options.nightMode) return nightElement;
      return null;
    }
  };
}

/** @returns {FakeStyleBag} */
function makeStyleBag() {
  /** @type {Map<string, string>} */
  const values = new Map();
  return {
    get(name) {
      return values.get(name);
    },
    has(name) {
      return values.has(name);
    },
    removeProperty(name) {
      values.delete(name);
    },
    setProperty(name, value) {
      values.set(name, value);
    }
  };
}

/** @returns {FakeClassList} */
function makeClassList() {
  /** @type {Set<string>} */
  const values = new Set();
  return {
    contains(name) {
      return values.has(name);
    },
    toggle(name, enabled) {
      if (enabled) values.add(name);
      else values.delete(name);
    }
  };
}
