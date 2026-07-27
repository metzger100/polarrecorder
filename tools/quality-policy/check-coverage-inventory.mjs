#!/usr/bin/env node

/**
 * Combined Python + viewer/plugin JS coverage inventory and ratchet.
 *
 * Reads the two reports `test:coverage:python`/`test:coverage:viewer` produce
 * (`coverage/python/coverage.json`, `coverage/viewer/coverage-summary.json`), then:
 *
 * - proves every shipped `server/polarrecorder/**\/*.py`, `plugin.py`, `viewer/*.js`,
 *   `plugin.js`, and `plugin.mjs` file is classified `measured` (present in a report) or
 *   `contract-owned` (named, runner-discovered owner test, never a partially-measured
 *   file);
 * - enforces the family floors (validation package, histogram core, Python aggregate,
 *   viewer family, plugin-entrypoint family) and the per-file `plugin.py`/viewer line
 *   floors recorded in `coverage-floors.json`;
 * - proves `coverage-floors.json` never regresses below `coverage-floor-baseline.json`,
 *   and that the baseline itself is exactly what `baseline-coverage-capture.json` derives
 *   (so the two cannot be edited together to silently lower the floor without a visible
 *   diff to this file's own self-test, which independently anchors the capture's digest).
 *
 * Supersedes `check-js-coverage.mjs` (deleted; c8 now attributes viewer/plugin VM
 * coverage directly) and `check-coverage.py` (deleted; its validation/histogram family
 * rules are folded in here so one tool owns the whole inventory).
 */

import fs from "node:fs";
import path from "node:path";

import { checkPythonCoverage } from "./coverage-inventory/python-coverage.mjs";
import { checkViewerCoverage } from "./coverage-inventory/viewer-coverage.mjs";
import {
  checkFloorRatchet,
  diffCoverageFloorBaseline
} from "./coverage-inventory/floor-baseline.mjs";
import {
  floorsPath,
  pythonReportPath,
  readJson,
  viewerReportPath
} from "./coverage-inventory/shared.mjs";

export {
  deriveCoverageFloorBaseline,
  diffCoverageFloorBaseline,
  checkFloorRatchet
} from "./coverage-inventory/floor-baseline.mjs";
export { listPythonPackageFiles } from "./coverage-inventory/python-coverage.mjs";
export { listViewerJsFiles } from "./coverage-inventory/viewer-coverage.mjs";
export {
  pythonReportPath,
  viewerReportPath,
  floorsPath,
  baselinePath
} from "./coverage-inventory/shared.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

/**
 * @param {string} root
 * @returns {any}
 */
export function loadPythonReport(root) {
  const reportPath = pythonReportPath(root);
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `coverage-inventory: missing ${path.relative(root, reportPath)}; run "npm run test:coverage:python" first`
    );
  }
  return readJson(reportPath);
}

/**
 * @param {string} root
 * @returns {Record<string, any>}
 */
export function loadViewerReport(root) {
  const reportPath = viewerReportPath(root);
  if (!fs.existsSync(reportPath)) {
    throw new Error(
      `coverage-inventory: missing ${path.relative(root, reportPath)}; run "npm run test:coverage:viewer" first`
    );
  }
  return readJson(reportPath);
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
export function runCoverageInventoryCheck(options = {}) {
  const root = options.root || ROOT;
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  failures.push(...diffCoverageFloorBaseline(root).failures);
  failures.push(...checkFloorRatchet(root).failures);

  const floors = readJson(floorsPath(root));
  try {
    const pythonReport = loadPythonReport(root);
    failures.push(...checkPythonCoverage(root, floors, pythonReport));
  } catch (error) {
    failures.push(/** @type {Error} */ (error).message);
  }
  try {
    const viewerReport = loadViewerReport(root);
    failures.push(...checkViewerCoverage(root, floors, viewerReport));
  } catch (error) {
    failures.push(/** @type {Error} */ (error).message);
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[coverage-inventory] ${failure}`);
    } else {
      console.log("Coverage inventory check passed.");
    }
  }
  return { ok: failures.length === 0, failures };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runCoverageInventoryCheck();
  process.exit(result.ok ? 0 : 1);
}
