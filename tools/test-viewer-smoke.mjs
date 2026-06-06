#!/usr/bin/env node

import assert from "node:assert/strict";

import { createEnvironment, flushViewer, loadViewerFile, textTree } from "./viewer-harness.mjs";

await testViewerModulesWorkTogether();

console.log("Viewer smoke tests passed.");

async function testViewerModulesWorkTogether() {
  const env = createEnvironment();
  loadViewerFile(env, "placeholders.js");
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "presets.js");
  loadViewerFile(env, "grid-editor.js");
  loadViewerFile(env, "polar-chart.js");
  loadViewerFile(env, "timeline-chart.js");
  loadViewerFile(env, "export-ui.js");
  loadViewerFile(env, "settings-ui.js");
  loadViewerFile(env, "viewer.js");

  testSharedHelpers(env);
  env.fireDOMContentLoaded();
  await flushViewer();

  assert.equal(env.window.Polarrecorder.PresetsCache.length, 4);
  env.clickTab("polar");
  await flushViewer();
  assert.equal(
    env.elements["polar-chart"].classList.contains("has-data"),
    true,
    "requests: " + env.requests.join(", ")
  );

  env.clickTab("status");
  await flushViewer();
  assert.equal(env.elements["status-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["status-panel"]).includes("Recording"));

  env.clickTab("timeline");
  await flushViewer();
  assert.equal(env.elements["timeline-chart"].classList.contains("has-data"), true);
  assert.equal(env.elements["timeline-ranges"].children.length, 3);

  env.clickTab("export");
  await flushViewer();
  assert.equal(env.elements["export-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["export-panel"]).includes("Export Configurator"));

  const preview = env.elements["export-panel"].querySelector(".preview-button");
  preview.click();
  await flushViewer();
  assert.ok(env.document.getElementById("csv-preview").value.includes("twa/tws"));

  env.clickTab("settings");
  await flushViewer();
  assert.equal(env.elements["settings-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["settings-panel"]).includes("JSON Backup"));

  const reset = env.elements["settings-panel"].querySelector(".danger-action");
  reset.click();
  await flushViewer();
  assert.ok(textTree(env.elements["settings-panel"]).includes("Type RESET"));

  env.window.Polarrecorder.ShowTooltip("hello", 500, 20);
  assert.ok(env.document.querySelector(".tooltip"));
}

function testSharedHelpers(env) {
  const recorder = env.window.Polarrecorder;
  assert.equal(recorder.Placeholders.NoData, "No Data");
  const button = recorder.Dom.Button("Do it", function () {
    button.dataset.clicked = "yes";
  }, "primary-action");
  button.click();
  assert.equal(button.dataset.clicked, "yes");
  assert.equal(recorder.Dom.ActionRow([button]).children.length, 1);
  recorder.Dom.Download("sample.txt", "payload", "text/plain");

  const fallback = recorder.Presets.Fallback();
  assert.equal(fallback.length, 4);
  assert.equal(recorder.Presets.Label(fallback[0]), "Default (Starboard 180°)");
  assert.equal(recorder.Presets.Label({ builtin: false, name: "Custom" }), "Custom");
}
