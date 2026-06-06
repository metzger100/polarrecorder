#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
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

testCopiesAvNavTokensAndFont();
testClearsOverridesWhenStandalone();
testCrossOriginParentFallsBackCleanly();

console.log("Viewer theme bridge tests passed.");

function testCopiesAvNavTokensAndFont() {
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
}

function testClearsOverridesWhenStandalone() {
  const env = loadTheme(makeParentDocument({
    fontFamily: "Verdana, Arial, sans-serif",
    nightMode: false,
    tokens: AVNAV_TOKENS
  }));

  env.fireDOMContentLoaded();
  env.setStandalone();
  env.fireDOMContentLoaded();

  assert.equal(env.classList.contains("nightMode"), false);
  assert.equal(env.style.has("--polarrecorder-main-color"), false);
  assert.equal(env.style.has("--polarrecorder-font-stack"), false);
}

function testCrossOriginParentFallsBackCleanly() {
  const env = loadTheme(makeParentDocument({
    fontFamily: "Verdana, Arial, sans-serif",
    nightMode: true,
    tokens: AVNAV_TOKENS
  }));
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
}

function loadTheme(parentDocument) {
  const listeners = new Map();
  const style = makeStyleBag();
  const classList = makeClassList();
  const localWindow = {
    Polarrecorder: {},
    setInterval() {}
  };
  const localDocument = {
    addEventListener(name, callback) {
      listeners.set(name, callback);
    },
    body: { classList, style },
    documentElement: {}
  };

  localWindow.parent = { document: parentDocument };
  vm.runInNewContext(THEME_SOURCE, { document: localDocument, window: localWindow }, {
    filename: path.join(ROOT, "viewer", "theme.js")
  });

  return {
    classList,
    fireDOMContentLoaded() {
      listeners.get("DOMContentLoaded")();
    },
    setStandalone() {
      localWindow.parent = localWindow;
    },
    style,
    window: localWindow
  };
}

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
          getPropertyValue(name) {
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

function makeStyleBag() {
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

function makeClassList() {
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
