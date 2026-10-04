import assert from "node:assert/strict";
import { test } from "vitest";

import {
  createEnvironment,
  defaultResponseBody,
  flushViewer,
  loadViewerFile,
  ok,
  textTree
} from "../../tools/viewer-harness.mjs";

/** @typedef {import("../../tools/viewer-harness.mjs").Environment} Environment */
/** @typedef {import("../../tools/viewer-harness.mjs").FakeElement} FakeElement */
/** @typedef {import("../../tools/viewer-harness.mjs").ApiResponse} ApiResponse */

const SETTINGS_MODULES = [
  "placeholders.js",
  "dom.js",
  "enhanced-rule-display.js",
  "status-ui.js",
  "presets.js",
  "grid-editor.js",
  "polar-chart-geometry.js",
  "polar-chart.js",
  "timeline-chart.js",
  "export-fields.js",
  "export-presets.js",
  "export-ui.js",
  "import-upload.js",
  "enhanced-settings.js",
  "advanced-settings.js",
  "settings-ui.js",
  "viewer.js"
];

/**
 * @param {string} endpoint
 * @returns {ApiResponse}
 */
function responder(endpoint) {
  if (endpoint.startsWith("advanced/settings")) {
    return ok({
      groups: [
        {
          label: "Core Filters",
          description: "Basic sailing-condition filters.",
          fields: [
            {
              description: "Rejects very light-air samples below this true-wind speed.",
              field: "low_wind_threshold",
              label: "Minimum true wind",
              max: 10,
              min: 0.5,
              step: "0.1",
              type: "FLOAT",
              value: 3
            }
          ]
        }
      ]
    });
  }
  if (endpoint.startsWith("export/json")) {
    return ok({ schema_version: 1, bins: { "90_12": { histogram: { 60: 2 }, total_accepted: 2 } } });
  }
  return defaultResponseBody(endpoint);
}

/** Minimal FileReader stand-in: `load` delivers `file.text`; a file marked unreadable fires `error`. */
class FakeFileReader {
  constructor() {
    /** @type {string | null} */
    this.result = null;
    /** @type {Record<string, () => void>} */
    this.listeners = {};
  }

  /**
   * @param {string} name
   * @param {() => void} callback
   */
  addEventListener(name, callback) {
    this.listeners[name] = callback;
  }

  /** @param {{text?: string, unreadable?: boolean}} file */
  readAsText(file) {
    Promise.resolve().then(() => {
      if (file.unreadable) {
        this.listeners.error();
        return;
      }
      this.result = file.text ?? "";
      this.listeners.load();
    });
  }
}

/**
 * @param {(endpoint: string) => ApiResponse | undefined} [override]
 * @returns {Promise<{env: Environment, panel: FakeElement}>}
 */
async function openSettings(override) {
  const env = createEnvironment({
    responder: (endpoint) => (override && override(endpoint)) || responder(endpoint)
  });
  /** @type {Record<string, unknown>} */ (env.context).FileReader = FakeFileReader;
  for (const name of SETTINGS_MODULES) loadViewerFile(env, name);
  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();
  return { env, panel: env.elements["settings-panel"] };
}

/**
 * @param {FakeElement} panel
 * @param {string} label
 * @returns {FakeElement}
 */
function buttonByText(panel, label) {
  const found = panel.querySelectorAll(".state-layer").find((item) => item.textContent === label);
  assert.ok(found, `expected the ${label} button`);
  return found;
}

/**
 * @param {FakeElement} panel
 * @param {string} title
 * @returns {FakeElement}
 */
function cardByTitle(panel, title) {
  const found = panel.children.find((card) => textTree(card).startsWith(title));
  assert.ok(found, `expected the ${title} card`);
  return found;
}

/**
 * @param {FakeElement} group
 * @param {string} type
 * @returns {FakeElement}
 */
function inputOfType(group, type) {
  const found = descendants(group, function (node) {
    return node.tagName === "input" && /** @type {Record<string, unknown>} */ (node).type === type;
  })[0];
  assert.ok(found, `expected a ${type} input`);
  return found;
}

/**
 * @param {FakeElement} panel
 * @param {string} text
 * @returns {FakeElement[]}
 */
function messageNodes(panel, text) {
  return descendants(panel, function (node) {
    return node.tagName === "p" && node.textContent === text;
  });
}

/**
 * @param {FakeElement} node
 * @param {string} name
 */
function fire(node, name) {
  const handler = /** @type {Record<string, unknown>} */ (node)["on" + name];
  assert.equal(typeof handler, "function", `expected a ${name} listener`);
  /** @type {() => void} */ (handler)();
}

/**
 * @param {FakeElement} panel
 * @param {string} cardTitle
 * @param {Record<string, unknown>} file
 */
function chooseAndConfirm(panel, cardTitle, file) {
  const restore = cardByTitle(panel, cardTitle).querySelectorAll(".settings-group")[1];
  const fileInput = inputOfType(restore, "file");
  /** @type {Record<string, unknown>} */ (fileInput).files = [file];
  fire(fileInput, "change");
  inputOfType(restore, "text").value = "RESTORE";
}

/**
 * @param {FakeElement} panel
 * @returns {FakeElement[]}
 */
function restoreControls(panel) {
  const inputs = descendants(panel, function (node) {
    return node.tagName === "input" && /** @type {Record<string, unknown>} */ (node).type === "file";
  });
  return [...inputs, buttonByText(panel, "Restore Learned Data"), buttonByText(panel, "Restore Presets")];
}

/**
 * @param {FakeElement} root
 * @param {(node: FakeElement) => boolean} predicate
 * @returns {FakeElement[]}
 */
function descendants(root, predicate) {
  /** @type {FakeElement[]} */
  const out = [];
  const visit = (/** @type {FakeElement} */ node) => {
    if (predicate(node)) out.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return out;
}

test("a backup-download message keeps an unsaved Advanced edit", async () => {
  const { panel } = await openSettings();
  const input = panel.querySelectorAll(".advanced-setting")[0].children.find((child) => child.tagName === "input");
  assert.ok(input, "expected the low_wind_threshold input");
  input.value = "4.2";

  buttonByText(panel, "Download Learned Data").click();
  await flushViewer();

  const after = panel.querySelectorAll(".advanced-setting")[0].children.find((child) => child.tagName === "input");
  assert.equal(after, input, "the Advanced card must not be rebuilt");
  assert.equal(input.value, "4.2");
  assert.ok(textTree(panel).includes("Backup downloaded."), textTree(panel));
});

test("a restore validation error keeps the chosen file and confirmation text", async () => {
  const { panel } = await openSettings();
  const restore = cardByTitle(panel, "Learned Data").querySelectorAll(".settings-group")[1];
  const fileInput = inputOfType(restore, "file");
  const confirmation = inputOfType(restore, "text");
  const file = { name: "polarrecorder-backup.json" };
  /** @type {Record<string, unknown>} */ (fileInput).files = [file];
  fire(fileInput, "change");
  confirmation.value = "restor";

  buttonByText(panel, "Restore Learned Data").click();
  await flushViewer();

  assert.equal(confirmation.value, "restor");
  assert.deepEqual(/** @type {Record<string, unknown>} */ (fileInput).files, [file]);
  assert.ok(textTree(restore).includes("polarrecorder-backup.json"), textTree(restore));
  assert.equal(inputOfType(cardByTitle(panel, "Learned Data"), "file"), fileInput);
  assert.ok(textTree(panel).includes("Type RESTORE before confirming."), textTree(panel));
});

test("a settings message renders once with the matching class", async () => {
  const { panel } = await openSettings();

  buttonByText(panel, "Reset Learned Data").click();
  await flushViewer();
  const errors = messageNodes(panel, "Type RESET before confirming.");
  assert.equal(errors.length, 1);
  assert.equal(errors[0].className, "error-text");

  buttonByText(panel, "Download Presets").click();
  await flushViewer();
  const infos = messageNodes(panel, "Presets downloaded.");
  assert.equal(infos.length, 1);
  assert.equal(infos[0].className, "helper");
  assert.equal(infos[0], errors[0], "the same message node is reused");
  assert.equal(messageNodes(panel, "Type RESET before confirming.").length, 0);
});

test("backup downloads are compact JSON", async () => {
  const { env, panel } = await openSettings();
  /** @type {string[]} */
  const downloads = [];
  const dom = /** @type {{Download: (name: string, text: string) => void}} */ (env.window.Polarrecorder.Dom);
  dom.Download = function (_name, text) {
    downloads.push(text);
  };

  buttonByText(panel, "Download Learned Data").click();
  buttonByText(panel, "Download Presets").click();
  await flushViewer();

  assert.equal(downloads.length, 2);
  for (const text of downloads) {
    assert.ok(!text.includes("\n") && !text.includes("  "), text);
    assert.equal(text, JSON.stringify(JSON.parse(text)));
  }
});

test("an oversized backup fails before the first chunk is sent", async () => {
  const { env, panel } = await openSettings(function (endpoint) {
    if (!endpoint.startsWith("import/begin")) return undefined;
    return ok({ token: "big-token", kind: "learned-data", max_bytes: 1048576, max_chunks: 4096 });
  });
  chooseAndConfirm(panel, "Learned Data", { name: "huge.json", text: "x".repeat(1572864) });

  buttonByText(panel, "Restore Learned Data").click();
  await flushViewer();
  await flushViewer();

  assert.ok(
    env.requests.some((url) => url.includes("import/begin")),
    env.requests.join(" | ")
  );
  assert.ok(!env.requests.some((url) => url.includes("import/chunk")), env.requests.join(" | "));
  assert.ok(
    env.requests.some((url) => url.endsWith("import/abort?token=big-token")),
    env.requests.join(" | ")
  );
  const errors = messageNodes(panel, "Backup file is 1.5 MiB, above the 1.0 MiB restore limit.");
  assert.equal(errors.length, 1, textTree(panel));
  assert.equal(errors[0].className, "error-text");
  assert.ok(restoreControls(panel).every((control) => !control.disabled));
});

test("restore controls stay disabled while an upload runs", async () => {
  /** @type {FakeElement[]} */
  let controls = [];
  /** @type {boolean[]} */
  const disabledDuringChunk = [];
  /** @type {string[]} */
  const messagesAtCommit = [];
  /** @type {FakeElement | null} */
  let panelRef = null;
  const { panel } = await openSettings(function (endpoint) {
    if (endpoint.startsWith("import/chunk")) {
      disabledDuringChunk.push(...controls.map((control) => control.disabled));
    }
    if (endpoint.startsWith("import/commit") && panelRef) {
      messagesAtCommit.push(textTree(panelRef));
    }
    return undefined;
  });
  panelRef = panel;
  controls = restoreControls(panel);
  assert.equal(controls.length, 4);
  chooseAndConfirm(panel, "Learned Data", { name: "backup.json", text: '{"schema_version":1}' });

  buttonByText(panel, "Restore Learned Data").click();
  await flushViewer();
  await flushViewer();

  assert.deepEqual(disabledDuringChunk, [true, true, true, true]);
  assert.ok(messagesAtCommit[0].includes("Uploading backup… 1 / 1"), messagesAtCommit.join(" | "));
  assert.ok(controls.every((control) => !control.disabled));
  assert.ok(textTree(panel).includes("Restored 4 bins"), textTree(panel));
});

test("a FileReader error is surfaced and re-enables restore", async () => {
  const { env, panel } = await openSettings();
  chooseAndConfirm(panel, "Presets", { name: "broken.json", unreadable: true });

  buttonByText(panel, "Restore Presets").click();
  await flushViewer();

  const errors = messageNodes(panel, "Could not read the backup file.");
  assert.equal(errors.length, 1, textTree(panel));
  assert.equal(errors[0].className, "error-text");
  assert.ok(!env.requests.some((url) => url.includes("import/begin")), env.requests.join(" | "));
  assert.ok(restoreControls(panel).every((control) => !control.disabled));
});
