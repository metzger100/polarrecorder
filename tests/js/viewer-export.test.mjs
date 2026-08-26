/**
 * Behavioral tests for viewer/export-ui.js: preset save (empty name, new name, existing-name
 * overwrite confirm accepted/declined), preset delete (builtin blocked, confirm
 * accepted/declined), preview/action error handling, and the cancel-save-box path.
 */

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

/** @type {string[]} */
const saveRequests = [];
/** @type {string[]} */
const deleteRequests = [];
/** @type {string[]} */
const polRequests = [];

/** @returns {{name: string, builtin: boolean, twa: number[], tws: number[]}[]} */
function customPresets() {
  return [
    { name: "DefaultStarboard180", builtin: true, twa: [0, 90, 180], tws: [4, 6, 8] },
    { name: "coastal-cruise", builtin: false, twa: [0, 45, 90], tws: [6, 9, 12] }
  ];
}

/** @param {string} endpoint */
function responder(endpoint) {
  if (endpoint.startsWith("presets/save")) {
    saveRequests.push(endpoint);
    return ok({
      preset: { name: "coastal-cruise", builtin: false, twa: [0, 45, 90], tws: [6, 9, 12] }
    });
  }
  if (endpoint.startsWith("presets/delete")) {
    deleteRequests.push(endpoint);
    return ok({});
  }
  if (endpoint.startsWith("presets")) {
    return ok({ presets: customPresets() });
  }
  if (endpoint.startsWith("export/pol")) {
    polRequests.push(endpoint);
    return ok({ pol: "TWA\\TWS\t4\r\n30\t4.0\r\n" });
  }
  if (endpoint.startsWith("export?")) {
    return ok({ csv: "twa/tws,4\n0,0.0\n" });
  }
  return defaultResponseBody(endpoint);
}

/** @param {Environment} env */
function loadExportViewer(env) {
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "enhanced-rule-display.js");
  loadViewerFile(env, "status-ui.js");
  loadViewerFile(env, "presets.js");
  loadViewerFile(env, "grid-editor.js");
  loadViewerFile(env, "polar-chart-geometry.js");
  loadViewerFile(env, "polar-chart.js");
  loadViewerFile(env, "timeline-chart.js");
  loadViewerFile(env, "export-fields.js");
  loadViewerFile(env, "export-presets.js");
  loadViewerFile(env, "export-ui.js");
  loadViewerFile(env, "import-upload.js");
  loadViewerFile(env, "enhanced-settings.js");
  loadViewerFile(env, "advanced-settings.js");
  loadViewerFile(env, "settings-ui.js");
  loadViewerFile(env, "viewer.js");
}

/**
 * @param {Environment} env
 * @returns {Promise<FakeElement>}
 */
async function openExportPanel(env) {
  loadExportViewer(env);
  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("export");
  await flushViewer();
  return env.elements["export-panel"];
}

/**
 * @param {FakeElement} panel
 * @param {string} text
 * @returns {FakeElement | undefined}
 */
function buttonByText(panel, text) {
  return panel
    .querySelectorAll(".primary-action, .secondary-action, .danger-action")
    .find((item) => item.textContent === text);
}

/**
 * @param {FakeElement} panel
 * @param {string} text
 * @returns {void}
 */
function clickButton(panel, text) {
  const button = buttonByText(panel, text);
  assert.ok(button, `expected a button labeled '${text}'`);
  button.click();
}

/**
 * @param {FakeElement} node
 * @returns {string | undefined}
 */
function inputType(node) {
  return /** @type {{type?: string}} */ (node).type;
}

/**
 * @param {FakeElement} node
 * @param {string} tagName
 * @param {FakeElement[]} out
 * @returns {void}
 */
function collectByTag(node, tagName, out) {
  if (node.tagName === tagName) out.push(node);
  for (const child of node.children) collectByTag(child, tagName, out);
}

/**
 * @param {FakeElement} node
 * @param {string} tagName
 * @returns {FakeElement[]}
 */
function allByTag(node, tagName) {
  /** @type {FakeElement[]} */
  const out = [];
  collectByTag(node, tagName, out);
  return out;
}

/**
 * @param {FakeElement} panel
 * @param {string} name
 */
function selectPreset(panel, name) {
  const select = allByTag(panel, "select")[0];
  assert.ok(select, "expected the preset select element");
  select.value = name;
  const onChange = /** @type {Record<string, unknown>} */ (select).onchange;
  if (typeof onChange === "function") onChange();
}

test("save box opens and saving an empty name shows an error", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  clickButton(panel, "Save as Preset");
  await flushViewer();
  const nameInput = allByTag(panel, "input").find((node) => inputType(node) === "text");
  assert.ok(nameInput, "expected the preset-name input");
  nameInput.value = "   ";

  const before = saveRequests.length;
  clickButton(panel, "Confirm Save");
  await flushViewer();

  assert.equal(saveRequests.length, before, "blank name must not save");
  assert.ok(textTree(panel).includes("Enter a preset name."), textTree(panel));
});

test("saving a brand-new preset name sends the save request and closes the save box", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  clickButton(panel, "Save as Preset");
  await flushViewer();
  const nameInput = allByTag(panel, "input").find((node) => inputType(node) === "text");
  assert.ok(nameInput, "expected the preset-name input");
  nameInput.value = "brand-new-preset";
  clickButton(panel, "Confirm Save");
  await flushViewer();
  await flushViewer();

  assert.ok(
    saveRequests.some((r) => r.includes("name=brand-new-preset")),
    saveRequests.join(" | ")
  );
  assert.ok(textTree(panel).includes("Preset saved."), textTree(panel));
  assert.equal(buttonByText(panel, "Cancel"), undefined, "save box should be closed");
});

test("cancel closes the save box without saving", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  clickButton(panel, "Save as Preset");
  await flushViewer();
  assert.ok(buttonByText(panel, "Cancel"), "expected the save box to be open");

  const before = saveRequests.length;
  clickButton(panel, "Cancel");
  await flushViewer();

  assert.equal(saveRequests.length, before);
  assert.equal(buttonByText(panel, "Cancel"), undefined);
});

test("overwriting an existing preset saves once confirmed", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  selectPreset(panel, "coastal-cruise");
  clickButton(panel, "Save as Preset");
  await flushViewer();

  const before = saveRequests.length;
  clickButton(panel, "Confirm Save");
  await flushViewer();

  assert.equal(saveRequests.length, before + 1, saveRequests.join(" | "));
  assert.ok(saveRequests[saveRequests.length - 1].includes("name=coastal-cruise"));
});

test("overwriting an existing preset does nothing when declined", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  env.window.confirm = () => false;
  selectPreset(panel, "coastal-cruise");
  clickButton(panel, "Save as Preset");
  await flushViewer();

  const before = saveRequests.length;
  clickButton(panel, "Confirm Save");
  await flushViewer();

  assert.equal(saveRequests.length, before, "declined overwrite must not save");
});

test("delete is blocked for a builtin preset", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  const before = deleteRequests.length;
  clickButton(panel, "Delete");
  await flushViewer();

  assert.equal(deleteRequests.length, before);
  assert.ok(textTree(panel).includes("Built-in presets cannot be deleted."), textTree(panel));
});

test("delete sends a request for a non-builtin preset once confirmed", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  selectPreset(panel, "coastal-cruise");
  const before = deleteRequests.length;
  clickButton(panel, "Delete");
  await flushViewer();

  assert.equal(deleteRequests.length, before + 1, deleteRequests.join(" | "));
  assert.ok(deleteRequests[deleteRequests.length - 1].includes("name=coastal-cruise"));
  assert.ok(textTree(panel).includes("Preset deleted."), textTree(panel));
});

test("delete does nothing for a non-builtin preset when declined", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);

  env.window.confirm = () => false;
  selectPreset(panel, "coastal-cruise");
  const before = deleteRequests.length;
  clickButton(panel, "Delete");
  await flushViewer();

  assert.equal(deleteRequests.length, before, "declined delete must not send a request");
});

test("an export action failure shows the error message", async () => {
  const env = createEnvironment({
    responder(endpoint) {
      if (endpoint.startsWith("export?")) {
        return { status: "ERROR", data: null, error: "boom" };
      }
      return responder(endpoint);
    }
  });
  const panel = await openExportPanel(env);

  clickButton(panel, "Preview");
  await flushViewer();

  assert.ok(textTree(panel).includes("boom"), textTree(panel));
});

test("routing POL is the first export action and downloads the dedicated response", async () => {
  const env = createEnvironment({ responder });
  const panel = await openExportPanel(env);
  /** @type {{filename: string, text: string, type: string}[]} */
  const downloads = [];
  const recorder = /** @type {{Dom: {Download: (filename: string, text: string, type: string) => void}}} */ (
    env.window.Polarrecorder
  );
  recorder.Dom.Download = function (filename, text, type) {
    downloads.push({ filename, text, type });
  };

  const buttons = panel.querySelectorAll(".primary-action");
  assert.equal(buttons[0].textContent, "Download Routing POL");
  assert.ok(textTree(panel).includes("folds port and starboard"), textTree(panel));
  const inputs = allByTag(panel, "input");
  const percentile = inputs.find((node) => inputType(node) === "number");
  const confidence = inputs.find((node) => inputType(node) === "checkbox");
  assert.ok(percentile, "expected the shared percentile control");
  assert.ok(confidence, "expected the shared confidence control");
  percentile.value = "70";
  confidence.checked = true;
  const onPercentile = /** @type {Record<string, unknown>} */ (percentile).oninput;
  const onConfidence = /** @type {Record<string, unknown>} */ (confidence).onchange;
  if (typeof onPercentile === "function") onPercentile();
  if (typeof onConfidence === "function") onConfidence();
  const before = polRequests.length;
  clickButton(panel, "Download Routing POL");
  await flushViewer();

  assert.equal(polRequests.length, before + 1);
  assert.equal(polRequests[polRequests.length - 1], "export/pol?percentile=70&high_confidence=yes");
  assert.deepEqual(downloads, [
    {
      filename: "polarrecorder-routing.pol",
      text: "TWA\\TWS\t4\r\n30\t4.0\r\n",
      type: "text/plain;charset=utf-8"
    }
  ]);
  assert.ok(textTree(panel).includes("Routing POL downloaded."), textTree(panel));
});

test("routing POL errors are visible and CSV download remains available", async () => {
  const env = createEnvironment({
    responder(endpoint) {
      if (endpoint.startsWith("export/pol")) {
        return { status: "ERROR", data: null, error: "POL matrix incomplete" };
      }
      return responder(endpoint);
    }
  });
  const panel = await openExportPanel(env);

  assert.ok(buttonByText(panel, "Download CSV"), "expected CSV download to remain available");
  clickButton(panel, "Download Routing POL");
  await flushViewer();

  assert.ok(textTree(panel).includes("POL matrix incomplete"), textTree(panel));
});
