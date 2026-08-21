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

function advancedGroups() {
  return [
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
        },
        {
          description: "Rejects samples inside this many degrees of the bow.",
          field: "head_to_wind_threshold",
          label: "Head-to-wind exclusion",
          max: 30,
          min: 5,
          step: "1",
          type: "NUMBER",
          value: 10
        },
        {
          description: "Writes one diagnostic log line per sampling iteration.",
          field: "debug_logging",
          label: "Debug logging",
          type: "BOOLEAN",
          value: false
        }
      ]
    }
  ];
}

/** @param {string} endpoint */
function responder(endpoint) {
  if (endpoint.startsWith("advanced/settings")) {
    return ok({ groups: advancedGroups() });
  }
  if (endpoint.startsWith("advanced/save")) {
    saveRequests.push(endpoint);
    return ok({ config: { low_wind_threshold: 4.2 } });
  }
  return defaultResponseBody(endpoint);
}

test("advanced settings render and save", async () => {
  const env = createEnvironment({ responder });
  loadSettingsViewer(env);

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const tree = textTree(panel);
  assert.ok(tree.includes("Data Sources"), tree);
  assert.ok(tree.includes("Advanced Settings"), tree);
  assert.ok(tree.includes("Core Filters"), tree);
  assert.ok(tree.includes("Minimum true wind"), tree);
  assert.ok(tree.includes("Debug logging"), tree);
  assert.ok(tree.includes("Rejects very light-air samples"), tree);
  assert.ok(!tree.includes("low_wind_threshold"), tree);
  assert.ok(!tree.includes("head_to_wind_threshold"), tree);
  assert.ok(!tree.includes("debug_logging"), tree);

  const input = panel.querySelectorAll(".advanced-setting")[0].children.find((child) => child.tagName === "input");
  assert.ok(input, "expected the low_wind_threshold input");
  input.value = "4.2";
  const checkbox = panel.querySelectorAll(".advanced-setting")[2].children.find((child) => child.tagName === "input");
  assert.ok(checkbox, "expected the debug_logging checkbox");
  checkbox.checked = true;
  const saveButton = advancedSaveButton(panel);
  assert.ok(saveButton, "expected the Save Advanced Settings button");
  saveButton.click();
  await flushViewer();

  assert.equal(saveRequests.length, 1, saveRequests.join(" | "));
  assert.ok(saveRequests[0].includes("low_wind_threshold=4.2"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("head_to_wind_threshold=10"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("debug_logging=true"), saveRequests[0]);
  assert.ok(textTree(panel).includes("Advanced settings saved."), textTree(panel));
});

test("core data sources render defaults and save all three keys", async () => {
  const env = createEnvironment({ responder });
  loadSettingsViewer(env);

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const sourceFields = panel.querySelectorAll(".source-key");
  assert.ok(textTree(panel.children[0]).includes("Data Sources"), "Data Sources card must be first");
  assert.equal(sourceFields.length, 3);
  const selects = sourceFields.map(function (field) {
    return field.children.find((child) => child.tagName === "select");
  });
  assert.equal(selects[0]?.value, "gps.trueWindAngle");
  assert.equal(selects[1]?.value, "gps.trueWindSpeed");
  assert.equal(selects[2]?.value, "gps.waterSpeed");
  assert.ok(selects[2], "expected the STW source select");
  selects[2].value = "gps.signalk.navigation.speedThroughWater";

  const before = saveRequests.length;
  const saveButton = sourceSaveButton(panel);
  assert.ok(saveButton, "expected the Save Data Sources button");
  saveButton.click();
  await flushViewer();

  assert.equal(saveRequests.length, before + 1);
  const request = saveRequests[saveRequests.length - 1];
  assert.ok(request.includes("twa_key=gps.trueWindAngle"), request);
  assert.ok(request.includes("tws_key=gps.trueWindSpeed"), request);
  assert.ok(request.includes("stw_key=gps.signalk.navigation.speedThroughWater"), request);
  assert.ok(textTree(panel).includes("Data sources saved."), textTree(panel));
});

test("advanced settings validates range", async () => {
  const env = createEnvironment({ responder });
  loadSettingsViewer(env);

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const input = panel.querySelectorAll(".advanced-setting")[0].children.find((child) => child.tagName === "input");
  assert.ok(input, "expected the low_wind_threshold input");
  input.value = "99";

  const before = saveRequests.length;
  const saveButton = advancedSaveButton(panel);
  assert.ok(saveButton, "expected the Save Advanced Settings button");
  saveButton.click();
  await flushViewer();

  assert.equal(saveRequests.length, before, "out-of-range value blocks save");
  assert.ok(textTree(panel).includes("Minimum true wind must be between 0.5 and 10."), textTree(panel));
});

/** @param {Environment} env */
function loadSettingsViewer(env) {
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
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
 * @param {FakeElement} panel
 * @returns {FakeElement | undefined}
 */
function advancedSaveButton(panel) {
  return panel.querySelectorAll(".primary-action").find(function (item) {
    return item.textContent === "Save Advanced Settings";
  });
}

/**
 * @param {FakeElement} panel
 * @returns {FakeElement | undefined}
 */
function sourceSaveButton(panel) {
  return panel.querySelectorAll(".primary-action").find(function (item) {
    return item.textContent === "Save Data Sources";
  });
}
