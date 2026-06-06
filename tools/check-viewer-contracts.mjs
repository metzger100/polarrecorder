#!/usr/bin/env node

/**
 * Behavioral smell contracts for the viewer, executed against the real scripts
 * through the shared vm harness. The static checkers prove the viewer never
 * *writes* a forbidden pattern; these contracts prove the viewer never
 * *renders* one. They are the JS-side twin of check-runtime-contracts.py
 * (which guards the Python export boundary) and mirror the dyninstruments
 * mapper-output-no-nan / placeholder / falsy-default-preservation contracts.
 *
 * Every scenario feeds a contract-valid API payload only - absent optionals are
 * expressed the way the producer expresses them (current_values: null), never
 * as malformed input, so the contracts never pressure the viewer into adding
 * the defensive guards the repo forbids.
 *
 * Exit 0 when every contract holds, 1 otherwise.
 */

import { pathToFileURL } from "node:url";

import {
  createEnvironment,
  defaultResponseBody,
  flushViewer,
  loadViewerFile,
  ok,
  statusPayload,
  textTree
} from "./viewer-harness.mjs";

const VIEWER_MODULES = [
  "placeholders.js",
  "dom.js",
  "presets.js",
  "grid-editor.js",
  "polar-chart.js",
  "timeline-chart.js",
  "export-ui.js",
  "settings-ui.js",
  "viewer.js"
];
const PANELS = ["polar-chart", "status-panel", "timeline-chart", "export-panel", "settings-panel"];
const TABS = ["polar", "status", "timeline", "export", "settings"];

// Whole-word sentinel tokens that must never reach rendered viewer text. A
// leak means a number became non-finite or an absent optional was stringified
// instead of routed to a placeholder.
const LEAK_PATTERNS = [/\bNaN\b/, /\bundefined\b/, /\bnull\b/];

export function findLeakTokens(text) {
  return LEAK_PATTERNS.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
}

function statusResponder(statusOverrides) {
  return function (endpoint) {
    if (endpoint.startsWith("status")) return ok(statusPayload(statusOverrides));
    return defaultResponseBody(endpoint);
  };
}

async function renderAllPanels(root, responder) {
  const env = createEnvironment(responder ? { responder } : {});
  for (const name of VIEWER_MODULES) loadViewerFile(env, name, root);
  env.fireDOMContentLoaded();
  await flushViewer();
  const panelText = {};
  for (const tab of TABS) {
    env.clickTab(tab);
    await flushViewer();
  }
  for (const id of PANELS) panelText[id] = textTree(env.elements[id]);
  return panelText;
}

export async function runViewerContracts({ root = process.cwd(), print = true } = {}) {
  const failures = [];

  const healthy = await renderAllPanels(root, null);
  for (const [id, text] of Object.entries(healthy)) {
    for (const token of findLeakTokens(text)) {
      failures.push(`viewer-render-no-sentinel: ${id} rendered a '${token}' token on a healthy payload`);
    }
  }

  const absent = await renderAllPanels(root, statusResponder({ current_values: null, warming_up: true }));
  const absentStatus = absent["status-panel"];
  if (!absentStatus.includes("No Data")) {
    failures.push("viewer-absent-placeholder: absent current_values must render 'No Data', not a sentinel");
  }
  for (const token of findLeakTokens(absentStatus)) {
    failures.push(`viewer-absent-placeholder: status-panel rendered a '${token}' token for absent current_values`);
  }

  const zeros = await renderAllPanels(root, statusResponder({
    current_values: {
      stw_age_s: 0,
      stw_kt: 0,
      stw_stale: false,
      twa_age_s: 0,
      twa_deg: 0,
      twa_stale: false,
      tws_age_s: 0,
      tws_kt: 0,
      tws_stale: false
    }
  }));
  const zeroStatus = zeros["status-panel"];
  if (!zeroStatus.includes("0.0")) {
    failures.push("viewer-falsy-preservation: a zero reading must render '0.0', not be clobbered to a placeholder");
  }
  if (zeroStatus.includes("No Data")) {
    failures.push("viewer-falsy-preservation: a present zero reading must not fall back to 'No Data'");
  }
  for (const token of findLeakTokens(zeroStatus)) {
    failures.push(`viewer-falsy-preservation: status-panel rendered a '${token}' token for zero readings`);
  }

  if (print) reportViewerContracts(failures);
  return { ok: failures.length === 0, failures };
}

function reportViewerContracts(failures) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[viewer-contracts] ${failure}`);
    console.error(`[viewer-contracts] ${failures.length} contract violation(s) found.`);
    return;
  }
  console.log("Viewer contract check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = await runViewerContracts();
  process.exit(result.ok ? 0 : 1);
}
