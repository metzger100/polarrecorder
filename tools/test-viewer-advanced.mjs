#!/usr/bin/env node

import assert from "node:assert/strict";

import {
  createEnvironment,
  defaultResponseBody,
  flushViewer,
  loadViewerFile,
  ok,
  textTree
} from "./viewer-harness.mjs";

const saveRequests = [];

await testAdvancedSettingsRenderAndSave();
await testAdvancedSettingsValidatesRange();

console.log("Viewer advanced settings tests passed.");

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

async function testAdvancedSettingsRenderAndSave() {
  const env = createEnvironment({ responder });
  loadSettingsViewer(env);

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const tree = textTree(panel);
  assert.ok(tree.includes("Advanced Settings"), tree);
  assert.ok(tree.includes("Core Filters"), tree);
  assert.ok(tree.includes("Minimum true wind"), tree);
  assert.ok(tree.includes("Debug logging"), tree);
  assert.ok(tree.includes("Rejects very light-air samples"), tree);
  assert.ok(!tree.includes("low_wind_threshold"), tree);
  assert.ok(!tree.includes("head_to_wind_threshold"), tree);
  assert.ok(!tree.includes("debug_logging"), tree);

  const input = panel.querySelectorAll(".advanced-setting")[0]
    .children.find((child) => child.tagName === "input");
  input.value = "4.2";
  const checkbox = panel.querySelectorAll(".advanced-setting")[2]
    .children.find((child) => child.tagName === "input");
  checkbox.checked = true;
  advancedSaveButton(panel).click();
  await flushViewer();

  assert.equal(saveRequests.length, 1, saveRequests.join(" | "));
  assert.ok(saveRequests[0].includes("low_wind_threshold=4.2"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("head_to_wind_threshold=10"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("debug_logging=true"), saveRequests[0]);
  assert.ok(textTree(panel).includes("Advanced settings saved."), textTree(panel));
}

async function testAdvancedSettingsValidatesRange() {
  const env = createEnvironment({ responder });
  loadSettingsViewer(env);

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const input = panel.querySelectorAll(".advanced-setting")[0]
    .children.find((child) => child.tagName === "input");
  input.value = "99";

  const before = saveRequests.length;
  advancedSaveButton(panel).click();
  await flushViewer();

  assert.equal(saveRequests.length, before, "out-of-range value blocks save");
  assert.ok(
    textTree(panel).includes("Minimum true wind must be between 0.5 and 10."),
    textTree(panel)
  );
}

function loadSettingsViewer(env) {
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "presets.js");
  loadViewerFile(env, "grid-editor.js");
  loadViewerFile(env, "polar-chart.js");
  loadViewerFile(env, "timeline-chart.js");
  loadViewerFile(env, "export-ui.js");
  loadViewerFile(env, "import-upload.js");
  loadViewerFile(env, "enhanced-settings.js");
  loadViewerFile(env, "advanced-settings.js");
  loadViewerFile(env, "settings-ui.js");
  loadViewerFile(env, "viewer.js");
}

function advancedSaveButton(panel) {
  return panel.querySelectorAll(".primary-action").find(function (item) {
    return item.textContent === "Save Advanced Settings";
  });
}
