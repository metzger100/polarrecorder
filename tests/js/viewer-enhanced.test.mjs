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
let keysRequests = 0;

function enhancedRules() {
  return [
    {
      rule: "reject_engine_rpm",
      enable_field: "enh_rpm_enabled",
      enabled: true,
      combinator: "all",
      keys: [{ field: "enh_rpm_key", key: "" }],
      thresholds: { enh_rpm_idle_max: 900 },
      status: "inactive_key_not_configured"
    },
    {
      rule: "reject_sog_stw_mismatch",
      enable_field: "enh_slip_enabled",
      enabled: true,
      combinator: "all",
      keys: [
        { field: "enh_sog_key", key: "gps.speed" },
        { field: "enh_current_drift_key", key: "gps.currentDrift" }
      ],
      thresholds: { enh_slip_sog_floor_kt: 1, enh_slip_ratio: 0.5 },
      status: "active"
    }
  ];
}

/** @param {string} endpoint */
function responder(endpoint) {
  if (endpoint.startsWith("enhanced/keys")) {
    keysRequests += 1;
    const keys = ["gps.speed", "gps.windAngle", "gps.windSpeed", "gps.currentDrift"];
    if (keysRequests > 1) {
      keys.push("gps.signalk.propulsion.0.revolutions");
    }
    return ok({ keys });
  }
  if (endpoint.startsWith("enhanced/status")) {
    return ok({ rules: enhancedRules() });
  }
  if (endpoint.startsWith("enhanced/save")) {
    saveRequests.push(endpoint);
    return ok({ config: { enh_rpm_idle_max: 900 } });
  }
  return defaultResponseBody(endpoint);
}

function loadEnhancedEnvironment() {
  const env = createEnvironment({ responder });
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
  return env;
}

test("enhanced settings render and save", async () => {
  const env = loadEnhancedEnvironment();

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const tree = textTree(panel);
  assert.ok(tree.includes("Enhanced Rules"), tree);
  assert.ok(tree.includes("Speed-log sanity (SOG vs STW)"), tree);
  assert.ok(tree.includes("Speed over ground source"), tree);
  assert.ok(tree.includes("Slip ratio (STW ÷ SOG)"), tree);
  assert.ok(tree.includes("active"), tree);
  assert.ok(tree.includes("no key set"), tree);
  assert.ok(!tree.includes("undefined"), tree);
  assert.ok(!tree.includes("NaN"), tree);
  assert.ok(!tree.includes("null"), tree);

  // Focusing a key dropdown pulls a fresh key list without a viewer reload.
  assert.equal(keysRequests, 2, "source and enhanced cards fetch keys");
  const keyWrap = panel.querySelectorAll(".enhanced-key")[0];
  const select = keyWrap.children.find((child) => child.tagName === "select");
  assert.ok(select, "expected a key <select>");
  assert.ok(select.onfocus, "expected a focus handler");
  select.onfocus();
  await flushViewer();
  assert.equal(keysRequests, 3, "focus re-fetched keys");
  const optionLabels = select.children.map((option) => option.textContent);
  assert.ok(optionLabels.includes("gps.signalk.propulsion.0.revolutions"), optionLabels.join(","));

  const saveButton = enhancedSaveButton(panel);
  assert.ok(saveButton, "expected the Save Enhanced Settings button");
  saveButton.click();
  await flushViewer();

  assert.equal(saveRequests.length, 1, saveRequests.join(" | "));
  assert.ok(saveRequests[0].includes("enh_rpm_enabled=true"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("enh_sog_key=gps.speed"), saveRequests[0]);
  assert.ok(saveRequests[0].includes("enh_slip_ratio=0.5"), saveRequests[0]);
  assert.ok(textTree(panel).includes("Enhanced settings saved."), textTree(panel));
});

test("enhanced settings validates thresholds", async () => {
  const env = loadEnhancedEnvironment();

  env.fireDOMContentLoaded();
  await flushViewer();
  env.clickTab("settings");
  await flushViewer();

  const panel = env.elements["settings-panel"];
  const thresholdWrap = panel.querySelectorAll(".enhanced-threshold")[0];
  const input = thresholdWrap.children.find((child) => child.tagName === "input");
  assert.ok(input, "expected a threshold input");
  input.value = "not-a-number";

  const before = saveRequests.length;
  const saveButton = enhancedSaveButton(panel);
  assert.ok(saveButton, "expected the Save Enhanced Settings button");
  saveButton.click();
  await flushViewer();

  assert.equal(saveRequests.length, before, "invalid threshold blocks the save request");
  assert.ok(textTree(panel).includes("Enter a valid number for every threshold before saving."), textTree(panel));
});

/**
 * @param {FakeElement} panel
 * @returns {FakeElement | undefined}
 */
function enhancedSaveButton(panel) {
  return panel.querySelectorAll(".primary-action").find(function (item) {
    return item.textContent === "Save Enhanced Settings";
  });
}
