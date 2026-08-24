#!/usr/bin/env node

/**
 * Dependency-free DOM/fetch harness for vm-loading the viewer scripts in Node.
 *
 * Shared by tests/js/viewer-smoke.test.mjs (end-to-end render walk) and
 * tests/js/viewer-render-contract.test.mjs (behavioral render contracts) so both drive
 * the real viewer through one fake host instead of duplicating ~400 lines of
 * stub DOM. createEnvironment accepts an optional responder so a contract can
 * feed absent/sparse API payloads; the default responder mirrors a healthy
 * recorder. Uses only Node's standard library.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

import { element, fakeUrl, findById, findFirstByClass, textTree } from "./viewer-harness/fake-dom.mjs";
import { defaultResponseBody, fallbackPresets, ok, statusPayload } from "./viewer-harness/fixtures.mjs";

export { ok, defaultResponseBody, statusPayload, fallbackPresets, textTree };

/**
 * @typedef {import("./viewer-harness/fake-dom.mjs").FakeClassList} FakeClassList
 * @typedef {import("./viewer-harness/fake-dom.mjs").FakeStyle} FakeStyle
 * @typedef {import("./viewer-harness/fake-dom.mjs").FakeClickEvent} FakeClickEvent
 * @typedef {import("./viewer-harness/fake-dom.mjs").FakeElement} FakeElement
 * @typedef {import("./viewer-harness/fake-dom.mjs").FakeUrl} FakeUrl
 * @typedef {import("./viewer-harness/fixtures.mjs").ApiResponse} ApiResponse
 * @typedef {import("./viewer-harness/fixtures.mjs").ApiResponder} ApiResponder
 * @typedef {import("./viewer-harness/fixtures.mjs").StatusPayload} StatusPayload
 * @typedef {import("./viewer-harness/fixtures.mjs").PresetFixture} PresetFixture
 */

/**
 * @typedef {{
 *   addEventListener: (name: string, callback: () => void) => void,
 *   body: FakeElement,
 *   createElement: (tagName: string) => FakeElement,
 *   createElementNS: (namespace: unknown, tagName: string) => FakeElement,
 *   createTextNode: (text: string) => FakeElement,
 *   getElementById: (id: string) => FakeElement | null,
 *   querySelector: (selector: string) => FakeElement | null,
 *   querySelectorAll: (selector: string) => FakeElement[]
 * }} FakeDocument
 */

/**
 * @typedef {{ ok: boolean, status: number, json: () => Promise<ApiResponse> }} FakeFetchResponse
 */

/**
 * @typedef {(url: string) => Promise<FakeFetchResponse>} FetchFn
 */

/**
 * @typedef {{
 *   Blob: typeof Blob,
 *   Polarrecorder: Record<string, unknown>,
 *   URL: FakeUrl,
 *   addEventListener: (name: string, callback: (event: { preventDefault: () => void }) => void) => void,
 *   confirm: () => boolean,
 *   innerHeight: number,
 *   innerWidth: number,
 *   localStorage: { getItem: (key: string) => string | null, setItem: (key: string, value: string) => void },
 *   setInterval: () => number,
 *   setTimeout: (callback: unknown) => number,
 *   fetch?: FetchFn
 * }} FakeWindow
 */

/**
 * @typedef {{
 *   Blob: typeof Blob,
 *   URL: FakeUrl,
 *   URLSearchParams: typeof URLSearchParams,
 *   document: FakeDocument,
 *   fetch: FetchFn,
 *   window: FakeWindow
 * }} FakeContext
 */

/**
 * @typedef {{ responder?: ApiResponder, storage?: Map<string, string>, storageFails?: boolean }} CreateEnvironmentOptions
 */

/**
 * @typedef {{
 *   context: FakeContext,
 *   document: FakeDocument,
 *   elements: Record<string, FakeElement>,
 *   fireDOMContentLoaded: () => void,
 *   clickTab: (name: string) => void,
 *   requests: string[],
 *   storage: Map<string, string>,
 *   window: FakeWindow
 * }} Environment
 */

/**
 * @param {Environment} env
 * @param {string} name
 * @param {string} [root]
 * @returns {void}
 */
export function loadViewerFile(env, name, root = process.cwd()) {
  const filename = path.join(root, "viewer", name);
  const source = fs.readFileSync(filename, "utf8");
  vm.runInNewContext(source, env.context, { filename });
}

/**
 * @param {CreateEnvironmentOptions} [options]
 * @returns {Environment}
 */
export function createEnvironment(options = {}) {
  const responder = options.responder || defaultResponseBody;
  /** @type {Map<string, Array<() => void>>} */
  const listeners = new Map();
  /** @type {Record<string, FakeElement>} */
  const elements = {
    "connection-banner": element("div"),
    "export-panel": element("div"),
    "polar-chart": element("div"),
    "polar-chips": element("div"),
    "polar-preset": element("select"),
    "settings-panel": element("div"),
    "status-panel": element("div"),
    "timeline-chart": element("div"),
    "timeline-ranges": element("div")
  };
  for (const [id, node] of Object.entries(elements)) {
    node.id = id;
  }

  const tabButtons = ["polar", "status", "timeline", "export", "settings"].map(function (name) {
    const button = element("button");
    button.dataset.tab = name;
    return button;
  });
  const tabPanels = ["polar", "status", "timeline", "export", "settings"].map(function (name) {
    const panel = element("section");
    panel.dataset.tabPanel = name;
    return panel;
  });
  const body = element("body");
  body.dataset.apiBase = "../api/";
  /** @type {FakeDocument} */
  const document = {
    addEventListener(/** @type {string} */ name, /** @type {() => void} */ callback) {
      const callbacks = listeners.get(name) || [];
      callbacks.push(callback);
      listeners.set(name, callbacks);
    },
    body,
    createElement(tagName) {
      return element(tagName);
    },
    createElementNS(_namespace, tagName) {
      return element(tagName);
    },
    createTextNode(text) {
      const node = element("#text");
      node.textContent = text;
      return node;
    },
    getElementById(id) {
      if (elements[id]) return elements[id];
      for (const root of Object.values(elements)) {
        const found = findById(root, id);
        if (found) return found;
      }
      return findById(body, id);
    },
    querySelector(selector) {
      if (selector === ".tooltip") return findFirstByClass(body, "tooltip");
      return null;
    },
    querySelectorAll(selector) {
      if (selector === "[data-tab]") return tabButtons;
      if (selector === "[data-tab-panel]") return tabPanels;
      return [];
    }
  };
  const storage = options.storage || new Map();
  /** @type {Map<string, Array<(event: { preventDefault: () => void }) => void>>} */
  const windowListeners = new Map();
  /** @type {FakeWindow} */
  const window = {
    Blob,
    Polarrecorder: {},
    URL: fakeUrl(),
    confirm() {
      return true;
    },
    innerHeight: 600,
    innerWidth: 800,
    addEventListener(name, callback) {
      const callbacks = windowListeners.get(name) || [];
      callbacks.push(callback);
      windowListeners.set(name, callbacks);
    },
    localStorage: {
      getItem(key) {
        return storage.get(key) || null;
      },
      setItem(key, value) {
        if (options.storageFails) {
          const event = { preventDefault() {} };
          (windowListeners.get("error") || []).forEach(function (callback) {
            callback(event);
          });
          return;
        }
        storage.set(key, value);
      }
    },
    setInterval() {
      return 1;
    },
    setTimeout(_callback) {
      return 1;
    }
  };
  /** @type {string[]} */
  const requests = [];
  /**
   * @param {string} url
   * @returns {Promise<FakeFetchResponse>}
   */
  const fetch = function (url) {
    requests.push(String(url));
    return fetchResponse(url, responder);
  };
  /** @type {FakeContext} */
  const context = {
    Blob,
    URL: window.URL,
    URLSearchParams,
    document,
    fetch,
    window
  };
  window.fetch = fetch;
  return {
    context,
    document,
    elements,
    fireDOMContentLoaded() {
      const callbacks = listeners.get("DOMContentLoaded");
      if (!callbacks) {
        throw new Error("viewer-harness: DOMContentLoaded listener not registered");
      }
      callbacks.forEach(function (callback) {
        callback();
      });
    },
    clickTab(name) {
      const button = tabButtons.find(function (item) {
        return item.dataset.tab === name;
      });
      if (!button) {
        throw new Error(`viewer-harness: no tab button for "${name}"`);
      }
      button.click();
    },
    requests,
    storage,
    window
  };
}

/**
 * @returns {Promise<void>}
 */
export async function flushViewer() {
  for (let index = 0; index < 16; index += 1) {
    await Promise.resolve();
  }
}

/**
 * @param {string} url
 * @param {ApiResponder} responder
 * @returns {Promise<FakeFetchResponse>}
 */
function fetchResponse(url, responder) {
  const endpoint = String(url).replace(/^\.\.\/api\//, "");
  return Promise.resolve({
    ok: true,
    status: 200,
    json() {
      return Promise.resolve(responder(endpoint));
    }
  });
}
