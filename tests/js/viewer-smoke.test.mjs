import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import {
  createEnvironment,
  defaultResponseBody,
  fallbackPresets,
  flushViewer,
  loadViewerApp,
  loadViewerFile,
  ok,
  textTree
} from "../../tools/viewer-harness.mjs";

/** @typedef {import("../../tools/viewer-harness.mjs").Environment} Environment */
/** @typedef {import("../../tools/viewer-harness.mjs").ApiResponse} ApiResponse */

/**
 * @param {Environment} env
 * @returns {any}
 */
function polarrecorderOf(env) {
  return env.window.Polarrecorder;
}

test("viewer modules work together", async () => {
  const env = createEnvironment();
  loadViewerApp(env);

  testSharedHelpers(env);
  env.fireDOMContentLoaded();
  await flushViewer();

  assert.equal(polarrecorderOf(env).ApiBase, "../api/");
  assert.equal(env.requests[0], "../api/presets");
  assert.equal(polarrecorderOf(env).PresetsCache.length, 4);
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
  assert.ok(textTree(env.elements["status-panel"]).includes("Candidates"));
  assert.ok(textTree(env.elements["status-panel"]).includes("Triggered predicates"));
  assert.ok(textTree(env.elements["status-panel"]).includes("unstable_twa"));
  assert.ok(textTree(env.elements["status-panel"]).includes("Enhanced Rule Availability"));
  assert.ok(textTree(env.elements["status-panel"]).includes("Unavailable"));

  env.clickTab("timeline");
  await flushViewer();
  assert.equal(env.elements["timeline-chart"].classList.contains("has-data"), true);
  assert.equal(env.elements["timeline-ranges"].children.length, 3);

  env.clickTab("export");
  await flushViewer();
  assert.equal(env.elements["export-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["export-panel"]).includes("Routing POL"));
  assert.ok(textTree(env.elements["export-panel"]).includes("Tack-aware CSV"));

  const preview = env.elements["export-panel"].querySelector(".preview-button");
  assert.ok(preview, "expected a preview button");
  preview.click();
  await flushViewer();
  const csvPreview = env.document.getElementById("csv-preview");
  assert.ok(csvPreview, "expected the csv-preview element");
  assert.ok(csvPreview.value.includes("twa/tws"));

  env.clickTab("settings");
  await flushViewer();
  assert.equal(env.elements["settings-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["settings-panel"]).includes("Learned Data"));
  assert.ok(textTree(env.elements["settings-panel"]).includes("Restore Learned Data"));
  assert.ok(textTree(env.elements["settings-panel"]).includes("Reset Learned Data"));
  assert.ok(textTree(env.elements["settings-panel"]).includes("Presets"));
  assert.ok(textTree(env.elements["settings-panel"]).includes("Advanced Settings"));
  assert.ok(textTree(env.elements["settings-panel"]).includes("Maximum value age"));

  await testSettingsActions(env);
  await testImportUpload(env);

  polarrecorderOf(env).Dom.ShowTooltip("hello", 500, 20);
  assert.ok(env.document.querySelector(".tooltip"));
});

test("viewer API base override", async () => {
  const env = createEnvironment();
  env.document.body.dataset.apiBase = "/plugins/user-polarrecorder/api";
  loadViewerFile(env, "dom.js");
  loadViewerFile(env, "enhanced-rule-display.js");
  loadViewerFile(env, "status-ui.js");
  loadViewerFile(env, "presets.js");
  loadViewerFile(env, "viewer.js");

  env.fireDOMContentLoaded();
  await flushViewer();

  assert.equal(polarrecorderOf(env).ApiBase, "/plugins/user-polarrecorder/api/");
  assert.equal(env.requests[0], "/plugins/user-polarrecorder/api/presets");
});

test("direct status-card headings use the shared card inset", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "viewer", "viewer-status-and-chart.css"), "utf8");

  assert.ok(source.includes(".card > h2 {\n  margin: 1rem 1rem 0.5rem;\n}"));
});

test("export grid fields accommodate three-digit TWA values", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "viewer", "viewer-settings-and-responsive.css"), "utf8");

  assert.ok(source.includes(".grid-token input {\n  width: 5.7143rem;\n  text-align: center;\n}"));
});

test("export grid actions retain their full touch target", () => {
  const source = fs.readFileSync(path.join(process.cwd(), "viewer", "viewer-settings-and-responsive.css"), "utf8");

  assert.ok(source.includes(".small-icon {\n  display: grid;\n  place-items: center;\n  flex: 0 0 auto;"));
});

/** @param {Environment} env */
async function testSettingsActions(env) {
  const panel = env.elements["settings-panel"];
  panel.querySelectorAll(".secondary-action")[0].click();
  const presetsDownload = panel.querySelectorAll(".primary-action").find(function (button) {
    return button.textContent === "Download Presets";
  });
  assert.ok(presetsDownload, "expected the Download Presets button");
  presetsDownload.click();
  await flushViewer();
  assert.ok(textTree(panel).includes("Presets downloaded."));

  // A restore button with neither confirmation text nor a file falls back to a guard.
  panel.querySelectorAll(".danger-action")[0].click();
  await flushViewer();
  assert.ok(textTree(env.elements["settings-panel"]).includes("Type RESTORE before confirming."));
}

/** @param {Environment} env */
async function testImportUpload(env) {
  const recorder = polarrecorderOf(env);
  /** @type {string[]} */
  const summaries = [];
  /** @type {string[]} */
  const progress = [];
  for (const kind of ["learned-data", "presets"]) {
    recorder.ImportUpload.UploadBackup(
      kind,
      '{"schema_version":1}',
      /** @param {string} text */
      function (text) {
        summaries.push(text);
      },
      /** @param {string} error */
      function (error) {
        summaries.push("error:" + error);
      },
      /**
       * @param {number} sent
       * @param {number} total
       */
      function (sent, total) {
        progress.push(kind + ":" + String(sent) + "/" + String(total));
      }
    );
  }
  await flushViewer();
  await flushViewer();
  await flushViewer();
  assert.ok(
    summaries.some((text) => text.includes("Restored 4 bins")),
    summaries.join(" | ")
  );
  assert.ok(
    summaries.some((text) => text.includes("user presets")),
    summaries.join(" | ")
  );
  assert.deepEqual(progress, ["learned-data:1/1", "presets:1/1"]);
}

/** @param {Environment} env */
function testSharedHelpers(env) {
  const recorder = polarrecorderOf(env);
  assert.equal(recorder.Placeholders.NoData, "No Data");
  const button = recorder.Dom.Button(
    "Do it",
    function () {
      button.dataset.clicked = "yes";
    },
    "primary-action"
  );
  button.click();
  assert.equal(button.dataset.clicked, "yes");
  assert.equal(recorder.Dom.ActionRow([button]).children.length, 1);
  recorder.Dom.Download("sample.txt", "payload", "text/plain");
  assert.equal(recorder.Dom.Node("span", "sample", "Text").textContent, "Text");

  const fallback = recorder.Presets.Fallback();
  assert.equal(fallback.length, 4);
  assert.equal(recorder.Presets.Label(fallback[0]), "Default (Starboard 180°)");
  assert.equal(recorder.Presets.Label({ builtin: false, name: "Custom" }), "Custom");
}

/**
 * @param {(endpoint: string) => ApiResponse | undefined} [override]
 * @returns {Promise<{env: Environment, beat: () => Promise<void>}>}
 */
async function bootShell(override) {
  const env = createEnvironment({
    responder: (endpoint) => (override && override(endpoint)) || defaultResponseBody(endpoint)
  });
  loadViewerApp(env);
  env.fireDOMContentLoaded();
  await flushViewer();
  const beat = async function () {
    env.intervals.forEach((callback) => callback());
    await flushViewer();
  };
  return { env, beat };
}

/**
 * Holds every request whose endpoint starts with `prefix` until its release callback runs.
 * @param {Environment} env
 * @param {string} prefix
 * @returns {Array<() => void>}
 */
function holdRequests(env, prefix) {
  const original = env.context.fetch;
  /** @type {Array<() => void>} */
  const held = [];
  env.context.fetch = function (url) {
    if (!String(url).replace("../api/", "").startsWith(prefix)) return original(url);
    return new Promise((resolve) => held.push(() => resolve(original(url))));
  };
  return held;
}

/**
 * @param {Environment} env
 * @returns {string[]}
 */
function polarFormats(env) {
  return env.requests
    .filter((url) => url.includes("api/polar?"))
    .map((url) => String(new URLSearchParams(url.split("?")[1]).get("format")));
}

test("preset refreshes keep one polar-select listener and one fetch per change", async () => {
  const { env } = await bootShell();
  for (let index = 0; index < 3; index += 1) await polarrecorderOf(env).RefreshPresets();
  const select = env.elements["polar-preset"];
  const before = polarFormats(env).length;

  select.value = "windy";
  select.dispatch("change");
  await flushViewer();

  assert.deepEqual(polarFormats(env).slice(before), ["windy"]);
  assert.equal(select.listeners.get("change")?.length, 1);
});

test("deleting the selected polar preset falls back without a banner", async () => {
  let presets = [...fallbackPresets(), { name: "mine", builtin: false, twa: [0, 90], tws: [8] }];
  const { env } = await bootShell(function (endpoint) {
    if (endpoint.startsWith("presets")) return ok({ presets });
    if (endpoint.includes("format=mine") && presets.length === 4) {
      return { status: "ERROR", data: null, error: "Unknown format 'mine'" };
    }
    return undefined;
  });
  await polarrecorderOf(env).RefreshPresets();
  const select = env.elements["polar-preset"];
  select.value = "mine";
  select.dispatch("change");
  await flushViewer();

  presets = fallbackPresets();
  await polarrecorderOf(env).RefreshPresets();
  env.clickTab("polar");
  await flushViewer();

  assert.equal(select.value, "DefaultStarboard180");
  assert.deepEqual(polarFormats(env).slice(-2), ["mine", "DefaultStarboard180"]);
  assert.equal(env.elements["connection-banner"].hidden, true);
});

test("an API error shows the server message and transport failures keep the connection text", async () => {
  const { env, beat } = await bootShell(function (endpoint) {
    if (endpoint.startsWith("timeline")) return { status: "ERROR", data: null, error: "Timeline unavailable" };
    return undefined;
  });
  const banner = env.elements["connection-banner"];

  env.clickTab("timeline");
  await flushViewer();
  assert.equal(banner.hidden, false);
  assert.equal(banner.textContent, "Polar Recorder error: Timeline unavailable");

  const original = env.context.fetch;
  env.context.fetch = () => Promise.reject(new TypeError("Failed to fetch"));
  await beat();
  assert.equal(banner.textContent, "Connection lost — retrying...");

  env.context.fetch = original;
  await beat();
  assert.equal(banner.hidden, true);
  assert.equal(banner.textContent, "Connection lost — retrying...");
});

test("a polar response for a superseded selection is dropped", async () => {
  const { env } = await bootShell();
  /** @type {string[]} */
  const rendered = [];
  const chart = polarrecorderOf(env).PolarChart;
  const render = chart.Render;
  chart.Render = function (/** @type {{format: string}} */ data, /** @type {unknown} */ options) {
    rendered.push(data.format);
    return render(data, options);
  };
  const held = holdRequests(env, "polar");
  const select = env.elements["polar-preset"];

  for (const name of ["windy", "Default360"]) {
    select.value = name;
    select.dispatch("change");
  }
  held[1]();
  await flushViewer();
  held[0]();
  await flushViewer();

  assert.equal(held.length, 2);
  assert.deepEqual(rendered, ["Default360"]);
});

test("the heartbeat keeps status polling single-flight", async () => {
  const { env, beat } = await bootShell();
  const held = holdRequests(env, "status");

  await beat();
  await beat();
  await beat();
  assert.equal(held.length, 1);

  held[0]();
  await flushViewer();
  await beat();
  assert.equal(held.length, 2);
});

test("the Export tab recovers after a failed first config fetch", async () => {
  let configFails = true;
  const { env, beat } = await bootShell(function (endpoint) {
    if (endpoint.startsWith("config") && configFails)
      return { status: "ERROR", data: null, error: "Config unavailable" };
    return undefined;
  });

  env.clickTab("export");
  await flushViewer();
  assert.equal(env.elements["export-panel"].classList.contains("has-data"), false);

  configFails = false;
  await beat();
  assert.equal(env.elements["export-panel"].classList.contains("has-data"), true);
  assert.ok(textTree(env.elements["export-panel"]).includes("Tack-aware CSV"));
});

test("a pending Pause keeps the rebuilt button disabled until it settles", async () => {
  const { env, beat } = await bootShell();
  env.clickTab("status");
  await flushViewer();
  const panel = env.elements["status-panel"];
  const held = holdRequests(env, "pause");
  const first = panel.querySelector(".primary-action");
  assert.ok(first, "expected the Pause button");

  first.click();
  await beat();
  const rebuilt = panel.querySelector(".primary-action");

  assert.ok(rebuilt && rebuilt !== first, "the status card was rebuilt");
  assert.equal(rebuilt.disabled, true);
  assert.equal(rebuilt.textContent, "Working");

  held[0]();
  await flushViewer();
  await flushViewer();
  const settled = panel.querySelector(".primary-action");
  assert.ok(settled, "expected the Pause button after settling");
  assert.equal(settled.disabled, false);
  assert.equal(settled.textContent, "Pause");
});
