import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
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

/**
 * @param {Array<{availability: string, rule: string}>} rules
 * @param {{storageGetFails?: boolean, storageSetFails?: boolean}} [storageOptions]
 * @param {Map<string, string>} [storage]
 */
function warningEnvironment(rules, storageOptions = {}, storage) {
  const env = createEnvironment({
    responder(endpoint) {
      if (endpoint.startsWith("enhanced/status")) return ok({ rules });
      return defaultResponseBody(endpoint);
    },
    storage,
    ...storageOptions
  });
  loadViewerModules(env);
  return env;
}

/** @param {Environment} env */
function loadViewerModules(env) {
  [
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
    "viewer.js",
    "engine-warning.js"
  ].forEach(function (file) {
    loadViewerFile(env, file);
  });
}

/** @param {Environment} env */
async function start(env) {
  env.fireDOMContentLoaded();
  await flushViewer();
}

/** @param {Environment} env */
function warning(env) {
  return env.document.body.querySelector(".engine-warning");
}

test("startup warning requires an active Engine RPM rule", async () => {
  const unavailable = warningEnvironment([{ rule: "reject_engine_rpm", availability: "unavailable" }]);
  await start(unavailable);
  const unavailableWarning = warning(unavailable);
  assert.ok(unavailableWarning);
  assert.ok(textTree(unavailableWarning).includes("Engine RPM enhanced rule is not active"));

  const disabled = warningEnvironment([{ rule: "reject_engine_rpm", availability: "disabled" }]);
  await start(disabled);
  assert.ok(warning(disabled));

  const unrelated = warningEnvironment([{ rule: "reject_shallow", availability: "active" }]);
  await start(unrelated);
  assert.ok(warning(unrelated));

  const active = warningEnvironment([{ rule: "reject_engine_rpm", availability: "active" }]);
  await start(active);
  assert.equal(warning(active), null);
});

test("Close only dismisses the current warning", async () => {
  const rules = [{ rule: "reject_engine_rpm", availability: "unavailable" }];
  const env = warningEnvironment(rules);
  await start(env);
  const modal = warning(env);
  assert.ok(modal);
  modal.querySelectorAll(".secondary-action")[0].click();
  assert.equal(warning(env), null);
  assert.equal(env.storage.size, 0);
  const fresh = warningEnvironment(rules, {}, env.storage);
  await start(fresh);
  assert.ok(warning(fresh));
});

test("Never show again stores the RPM-specific suppression preference", async () => {
  const rules = [{ rule: "reject_engine_rpm", availability: "unavailable" }];
  const env = warningEnvironment(rules);
  await start(env);
  const modal = warning(env);
  assert.ok(modal);
  const never = modal.querySelectorAll(".primary-action")[0];
  assert.equal(never.textContent, "Never show again");
  never.click();
  assert.equal(warning(env), null);
  assert.equal(env.storage.get("polarrecorder.engine-rpm-warning.v1"), "hidden");
  const fresh = warningEnvironment(rules, {}, env.storage);
  await start(fresh);
  assert.equal(warning(fresh), null);
});

test("enhanced-status failure warns without blocking viewer startup", async () => {
  const env = createEnvironment({
    responder(endpoint) {
      if (endpoint.startsWith("enhanced/status")) {
        return { data: {}, status: "ERROR", error: "offline" };
      }
      return defaultResponseBody(endpoint);
    }
  });
  loadViewerModules(env);
  await start(env);
  assert.ok(warning(env));
  assert.equal(env.window.Polarrecorder.ApiBase, "../api/");
});

test("storage read failures warn without crashing startup", async () => {
  const env = warningEnvironment([{ rule: "reject_engine_rpm", availability: "unavailable" }], {
    storageGetFails: true
  });
  await start(env);
  assert.ok(warning(env));
});

test("storage write failures stay visible", async () => {
  const env = warningEnvironment([{ rule: "reject_engine_rpm", availability: "unavailable" }], {
    storageSetFails: true
  });
  await start(env);
  const modal = warning(env);
  assert.ok(modal);
  modal.querySelectorAll(".primary-action")[0].click();
  assert.ok(textTree(modal).includes("preference could not be saved"));
});

test("warning is an accessible focus-contained modal and restores focus", async () => {
  const env = warningEnvironment([{ rule: "reject_engine_rpm", availability: "unavailable" }]);
  const previous = env.document.createElement("button");
  env.document.body.appendChild(previous);
  previous.focus();
  await start(env);
  const modal = warning(env);
  assert.ok(modal);
  const buttons = modal.querySelectorAll(".secondary-action, .primary-action");
  assert.equal(modal.getAttribute("role"), "dialog");
  assert.equal(modal.getAttribute("aria-modal"), "true");
  assert.equal(modal.getAttribute("aria-labelledby"), "engine-warning-title");
  assert.equal(env.document.body.querySelectorAll(".engine-warning-backdrop").length, 1);
  assert.equal(env.elements["polarrecorder-app"].inert, true);
  assert.equal(env.document.activeElement, buttons[0]);
  env.fireKeydown("Tab", true);
  assert.equal(env.document.activeElement, buttons[1]);
  env.fireKeydown("Tab");
  assert.equal(env.document.activeElement, buttons[0]);
  env.fireKeydown("Escape");
  assert.equal(warning(env), null);
  assert.equal(env.elements["polarrecorder-app"].inert, false);
  assert.equal(env.document.activeElement, previous);
});

test("warning restores pre-existing background accessibility state", async () => {
  const env = warningEnvironment([{ rule: "reject_engine_rpm", availability: "unavailable" }]);
  const background = env.elements["polarrecorder-app"];
  background.inert = true;
  background.setAttribute("aria-hidden", "false");
  await start(env);
  const modal = warning(env);
  assert.ok(modal);
  modal.querySelectorAll(".secondary-action")[0].click();
  assert.equal(background.inert, true);
  assert.equal(background.getAttribute("aria-hidden"), "false");
});

test("warning CSS keeps the dialog content-sized and centered", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "viewer", "engine-warning.css"), "utf8");

  assert.ok(source.includes("top: 50%;"));
  assert.ok(source.includes("left: 50%;"));
  assert.ok(source.includes(".engine-warning-backdrop"));
  assert.ok(source.includes("z-index: 101;"));
  assert.ok(source.includes("transform: translate(-50%, -50%);"));
  assert.ok(source.includes("width: min(34rem, calc(100vw - 2rem));"));
  assert.ok(source.includes("max-height: calc(100vh - 2rem);"));
  assert.ok(source.includes(".engine-warning .action-row"));
  assert.ok(source.includes("flex-wrap: wrap;"));
  assert.equal(source.includes("inset: 1rem;"), false);
});
