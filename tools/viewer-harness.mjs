#!/usr/bin/env node

/**
 * Dependency-free DOM/fetch harness for vm-loading the viewer scripts in Node.
 *
 * Shared by tests/js/viewer-smoke.test.mjs (end-to-end render walk) and
 * tools/check-viewer-contracts.mjs (behavioral smell contracts) so both drive
 * the real viewer through one fake host instead of duplicating ~400 lines of
 * stub DOM. createEnvironment accepts an optional responder so a contract can
 * feed absent/sparse API payloads; the default responder mirrors a healthy
 * recorder. Uses only Node's standard library.
 */

import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

/**
 * @typedef {{
 *   add: (name: string) => void,
 *   contains: (name: string) => boolean,
 *   remove: (name: string) => void,
 *   toggle: (name: string, enabled: boolean) => void
 * }} FakeClassList
 */

/**
 * @typedef {{
 *   background: string,
 *   left: string,
 *   top: string,
 *   getPropertyValue: (name: string) => string,
 *   removeProperty: (name: string) => void,
 *   setProperty: (name: string, value: unknown) => void
 * }} FakeStyle
 */

/**
 * @typedef {{ clientX: number, clientY: number }} FakeClickEvent
 */

/**
 * A fake DOM node produced by element(). Every node produced by the harness
 * carries all of these members; classList and firstChild are populated by
 * element() itself before the node is ever handed to a caller. id, onclick,
 * onfocus, and checked are genuinely absent until the harness (or the
 * vm-loaded viewer script) sets them -- checked stands in for a
 * checkbox-role <input>'s real DOM `.checked` property, and onfocus is
 * addEventListener("focus", ...)'s storage slot, mirroring onclick.
 *
 * @typedef {{
 *   attributes: Map<string, string>,
 *   checked?: boolean,
 *   children: FakeElement[],
 *   className: string,
 *   classList: FakeClassList,
 *   dataset: Record<string, string>,
 *   disabled: boolean,
 *   firstChild: FakeElement | null,
 *   hidden: boolean,
 *   id?: string,
 *   onclick?: (event: FakeClickEvent) => void,
 *   onfocus?: () => void,
 *   parentNode: FakeElement | null,
 *   style: FakeStyle,
 *   tagName: string,
 *   textContent: string,
 *   value: string,
 *   appendChild: (child: FakeElement) => FakeElement,
 *   addEventListener: (name: string, callback: (event?: unknown) => void) => void,
 *   click: () => void,
 *   closest: (selector: string) => FakeElement | null,
 *   getAttribute: (name: string) => string | undefined,
 *   querySelector: (selector: string) => FakeElement | null,
 *   querySelectorAll: (selector: string) => FakeElement[],
 *   remove: () => void,
 *   removeChild: (child: FakeElement) => FakeElement,
 *   setAttribute: (name: string, value: unknown) => void
 * }} FakeElement
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
 * @typedef {{ createObjectURL: () => string, revokeObjectURL: () => void }} FakeUrl
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
 *   confirm: () => boolean,
 *   innerHeight: number,
 *   innerWidth: number,
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
 * @typedef {{ data: unknown, status: string }} ApiResponse
 */

/**
 * @typedef {(endpoint: string) => ApiResponse} ApiResponder
 */

/**
 * @typedef {{ responder?: ApiResponder }} CreateEnvironmentOptions
 */

/**
 * @typedef {{
 *   context: FakeContext,
 *   document: FakeDocument,
 *   elements: Record<string, FakeElement>,
 *   fireDOMContentLoaded: () => void,
 *   clickTab: (name: string) => void,
 *   requests: string[],
 *   window: FakeWindow
 * }} Environment
 */

/**
 * @typedef {{
 *   acceptance_rate: number,
 *   total_accepted: number,
 *   total_quarantined: number,
 *   total_rejected: number,
 *   total_seen: number
 * }} StatusCounters
 */

/**
 * @typedef {{
 *   stw_age_s: number,
 *   stw_kt: number,
 *   stw_stale: boolean,
 *   twa_age_s: number,
 *   twa_deg: number,
 *   twa_stale: boolean,
 *   tws_age_s: number,
 *   tws_kt: number,
 *   tws_stale: boolean
 * }} StatusCurrentValues
 */

/**
 * @typedef {{
 *   counters: StatusCounters,
 *   current_decision: { reason_codes: string[], state: string },
 *   current_values: StatusCurrentValues | null,
 *   data_status: string,
 *   generation: number,
 *   persistence: {
 *     bins_total: number,
 *     bins_with_data: number,
 *     file_size_bytes: number,
 *     last_flush_wall: number
 *   },
 *   recording: boolean,
 *   top_rejections: Array<{ count: number, reason: string }>,
 *   uptime_seconds: number,
 *   warming_up: boolean
 * }} StatusPayload
 */

/**
 * @typedef {{ builtin: boolean, name: string, twa: number[], tws: number[] }} PresetFixture
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
 * @template T
 * @param {T} data
 * @returns {{ data: T, status: string }}
 */
export function ok(data) {
  return { data, status: "OK" };
}

/**
 * @param {string} endpoint
 * @returns {ApiResponse}
 */
export function defaultResponseBody(endpoint) {
  if (endpoint.startsWith("presets")) {
    return ok({ presets: fallbackPresets() });
  }
  if (endpoint.startsWith("polar")) {
    /** @type {Array<{ samples: number, stw: number }>} */
    const curve = [];
    curve[0] = { samples: 0, stw: 0 };
    curve[90] = { samples: 20, stw: 6.2 };
    return ok({
      curves: { 12: curve },
      format: "DefaultStarboard180",
      generation: 2,
      percentile: 65,
      tws_bands: [12]
    });
  }
  if (endpoint.startsWith("status")) {
    return ok(statusPayload());
  }
  if (endpoint.startsWith("timeline")) {
    return ok({
      buckets: [
        { accepted: 2, quarantined: 0, reasons: {}, rejected: 1, t: 1000 },
        { accepted: 1, quarantined: 1, reasons: { r12: 1 }, rejected: 0, t: 1060 }
      ]
    });
  }
  if (endpoint.startsWith("config")) {
    return ok({ min_samples_for_export: 8, percentile: 65 });
  }
  if (endpoint.startsWith("advanced/settings")) {
    return ok({
      groups: [
        {
          label: "Sensor Freshness",
          description: "Timing checks for core readings.",
          fields: [
            {
              description: "Rejects old core values.",
              field: "stale_threshold",
              label: "Maximum value age",
              max: 30,
              min: 1,
              step: "0.1",
              type: "FLOAT",
              value: 3
            }
          ]
        }
      ]
    });
  }
  if (endpoint.startsWith("advanced/save")) {
    return ok({ config: { stale_threshold: 3 } });
  }
  if (endpoint.startsWith("export/json")) {
    return ok({ schema_version: 1, bins: {} });
  }
  if (endpoint.startsWith("export/presets")) {
    return ok({ schema_version: 1, presets: {} });
  }
  if (endpoint.startsWith("import/begin")) {
    return ok({ token: "test-token", kind: "learned-data", max_bytes: 4194304, max_chunks: 4096 });
  }
  if (endpoint.startsWith("import/chunk")) {
    return ok({ received: 1, bytes: 12 });
  }
  if (endpoint.startsWith("import/commit")) {
    return ok({
      bins_restored: 4,
      total_accepted: 40,
      migrated_from_version: 1,
      presets_restored: 2
    });
  }
  if (endpoint.startsWith("import/abort")) {
    return ok({});
  }
  if (endpoint.startsWith("export?")) {
    return ok({ csv: "twa/tws,4,6\n0,0.0,0.0\n90,5.0,6.0\n" });
  }
  if (endpoint.startsWith("reset")) {
    return ok({});
  }
  return ok({});
}

/**
 * @param {Partial<StatusPayload>} [overrides]
 * @returns {StatusPayload}
 */
export function statusPayload(overrides = {}) {
  return {
    counters: {
      acceptance_rate: 0.75,
      total_accepted: 30,
      total_quarantined: 2,
      total_rejected: 8,
      total_seen: 40
    },
    current_decision: { reason_codes: [], state: "accepted" },
    current_values: {
      stw_age_s: 0.5,
      stw_kt: 5.9,
      stw_stale: false,
      twa_age_s: 0.3,
      twa_deg: 90,
      twa_stale: false,
      tws_age_s: 0.4,
      tws_kt: 12,
      tws_stale: false
    },
    data_status: "receiving",
    generation: 2,
    persistence: {
      bins_total: 3600,
      bins_with_data: 12,
      file_size_bytes: 1234,
      last_flush_wall: Math.round(Date.now() / 1000) - 120
    },
    recording: true,
    top_rejections: [{ count: 3, reason: "r12" }],
    uptime_seconds: 3600,
    warming_up: false,
    ...overrides
  };
}

/**
 * @returns {PresetFixture[]}
 */
export function fallbackPresets() {
  return [
    { builtin: true, name: "DefaultStarboard180", twa: [0, 90, 180], tws: [4, 6, 8] },
    { builtin: true, name: "DefaultPort180", twa: [180, 270, 345], tws: [4, 6, 8] },
    { builtin: true, name: "Default360", twa: [0, 90, 180, 270], tws: [4, 6, 8] },
    { builtin: true, name: "windy", twa: [0, 30, 40, 52, 60, 90, 120, 150, 180], tws: [4, 6, 8] }
  ];
}

/**
 * @param {CreateEnvironmentOptions} [options]
 * @returns {Environment}
 */
export function createEnvironment(options = {}) {
  const responder = options.responder || defaultResponseBody;
  /** @type {Map<string, () => void>} */
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
    addEventListener(name, callback) {
      listeners.set(name, callback);
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
      const callback = listeners.get("DOMContentLoaded");
      if (!callback) {
        throw new Error("viewer-harness: DOMContentLoaded listener not registered");
      }
      callback();
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
    window
  };
}

/**
 * @param {FakeElement} node
 * @returns {string}
 */
export function textTree(node) {
  return node.textContent + node.children.map(textTree).join("");
}

/**
 * @returns {Promise<void>}
 */
export async function flushViewer() {
  for (let index = 0; index < 8; index += 1) {
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

/**
 * @param {string} tagName
 * @returns {FakeElement}
 */
function element(tagName) {
  /** @type {FakeElement} */
  const node = {
    attributes: new Map(),
    children: [],
    className: "",
    dataset: {},
    disabled: false,
    firstChild: null,
    hidden: false,
    parentNode: null,
    style: styleBag(),
    tagName,
    textContent: "",
    value: "",
    appendChild(child) {
      child.parentNode = node;
      node.children.push(child);
      return child;
    },
    addEventListener(name, callback) {
      const bag = /** @type {Record<string, unknown>} */ (node);
      bag["on" + name] = callback;
    },
    click() {
      if (node.onclick) node.onclick({ clientX: 20, clientY: 20 });
    },
    closest(selector) {
      if (!selector.startsWith(".")) return null;
      /** @type {FakeElement | null} */
      let current = node;
      const className = selector.slice(1);
      while (current) {
        if (current.classList.contains(className)) return current;
        current = current.parentNode;
      }
      return null;
    },
    getAttribute(name) {
      return node.attributes.get(name);
    },
    querySelector(selector) {
      const selectors = selector.split(",").map(function (item) {
        return item.trim();
      });
      return findFirst(node, function (candidate) {
        return selectors.some(function (entry) {
          return matches(candidate, entry);
        });
      });
    },
    querySelectorAll(selector) {
      const selectors = selector.split(",").map(function (item) {
        return item.trim();
      });
      return findAll(node, function (candidate) {
        return selectors.some(function (entry) {
          return matches(candidate, entry);
        });
      });
    },
    remove() {
      if (!node.parentNode) return;
      node.parentNode.children = node.parentNode.children.filter(function (child) {
        return child !== node;
      });
      node.parentNode = null;
    },
    removeChild(child) {
      node.children = node.children.filter(function (item) {
        return item !== child;
      });
      child.parentNode = null;
      return child;
    },
    setAttribute(name, value) {
      node.attributes.set(name, String(value));
    },
    // classList closes over `node`, so it can only be built once `node`
    // exists; this placeholder is overwritten immediately below, before the
    // node is returned to any caller.
    classList: /** @type {FakeClassList} */ ({})
  };
  Object.defineProperty(node, "firstChild", {
    enumerable: false,
    configurable: false,
    get() {
      return node.children[0] || null;
    }
  });
  node.classList = classList(node);
  return node;
}

/**
 * @param {FakeElement} node
 * @returns {FakeClassList}
 */
function classList(node) {
  return {
    add(name) {
      const values = classSet(node);
      values.add(name);
      node.className = Array.from(values).join(" ");
    },
    contains(name) {
      return classSet(node).has(name);
    },
    remove(name) {
      const values = classSet(node);
      values.delete(name);
      node.className = Array.from(values).join(" ");
    },
    toggle(name, enabled) {
      if (enabled) this.add(name);
      else this.remove(name);
    }
  };
}

/**
 * @param {FakeElement} node
 * @returns {Set<string>}
 */
function classSet(node) {
  return new Set(
    String(node.className || "")
      .split(/\s+/)
      .filter(Boolean)
  );
}

/**
 * @returns {FakeStyle}
 */
function styleBag() {
  /** @type {Map<string, string>} */
  const values = new Map();
  return {
    set background(/** @type {string} */ value) {
      values.set("background", value);
    },
    set left(/** @type {string} */ value) {
      values.set("left", value);
    },
    set top(/** @type {string} */ value) {
      values.set("top", value);
    },
    getPropertyValue(name) {
      return values.get(name) || "";
    },
    removeProperty(name) {
      values.delete(name);
    },
    setProperty(name, value) {
      values.set(name, String(value));
    }
  };
}

/**
 * @returns {FakeUrl}
 */
function fakeUrl() {
  return {
    createObjectURL() {
      return "blob:polarrecorder-test";
    },
    revokeObjectURL() {}
  };
}

/**
 * @param {FakeElement} node
 * @param {string} selector
 * @returns {boolean}
 */
function matches(node, selector) {
  if (selector.startsWith(".")) return node.classList.contains(selector.slice(1));
  return false;
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeElement) => boolean} predicate
 * @returns {FakeElement | null}
 */
function findFirst(root, predicate) {
  return findAll(root, predicate)[0] || null;
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeElement) => boolean} predicate
 * @returns {FakeElement[]}
 */
function findAll(root, predicate) {
  /** @type {FakeElement[]} */
  const out = [];
  walk(root, function (node) {
    if (predicate(node)) out.push(node);
  });
  return out;
}

/**
 * @param {FakeElement} root
 * @param {string} id
 * @returns {FakeElement | null}
 */
function findById(root, id) {
  return findFirst(root, function (node) {
    return node.id === id;
  });
}

/**
 * @param {FakeElement} root
 * @param {string} name
 * @returns {FakeElement | null}
 */
function findFirstByClass(root, name) {
  return findFirst(root, function (node) {
    return node.classList.contains(name);
  });
}

/**
 * @param {FakeElement} node
 * @param {(node: FakeElement) => void} visit
 * @returns {void}
 */
function walk(node, visit) {
  visit(node);
  node.children.forEach(function (child) {
    walk(child, visit);
  });
}
