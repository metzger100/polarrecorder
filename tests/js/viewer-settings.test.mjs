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
  if (endpoint.startsWith("export/json")) return ok({ schema_version: 1, bins: {} });
  return defaultResponseBody(endpoint);
}

/** @returns {Promise<{env: Environment, panel: FakeElement}>} */
async function openSettings() {
  const env = createEnvironment({ responder });
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
