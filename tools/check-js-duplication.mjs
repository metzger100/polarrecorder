#!/usr/bin/env node

/**
 * Cross-file duplicate-function detector for viewer/*.js.
 *
 * AI agents reliably re-implement a viewer helper instead of reusing the
 * canonical one under window.Polarrecorder (AGENTS.md Section 8). This is the
 * JS counterpart to tools/check-duplication.py, which only covers Python.
 *
 * Each function body is reduced to a structural fingerprint: bare local
 * identifiers are normalised to "ID" (so variable-renamed copies still match)
 * while member names (.foo), called keywords, operators, punctuation and
 * literal values are preserved (so unrelated same-shape functions do not
 * collide). Two functions in different files sharing a fingerprint above the
 * token threshold are flagged; the fix is to extract one canonical helper.
 *
 * Exit 0 when clean, 1 when duplicates are found.
 */

import path from "node:path";
import { pathToFileURL } from "node:url";

import { collectFunctions } from "./check-js-duplication/parse.mjs";
import {
  MIN_FINGERPRINT_TOKENS,
  duplicateBlockFailures
} from "./check-js-duplication/clone-detection.mjs";

/**
 * @typedef {import("./check-js-duplication/clone-detection.mjs").FunctionEntry} FunctionEntry
 */

/**
 * @typedef {object} DuplicationOptions
 * @property {string} [root] - Repository root to scan; defaults to process.cwd().
 * @property {boolean} [print] - Whether to log a human-readable report.
 */

/**
 * @typedef {object} DuplicationSummary
 * @property {boolean} ok
 * @property {number} checkedFunctions
 * @property {number} failures
 */

/**
 * @typedef {object} DuplicationResult
 * @property {boolean} ok
 * @property {string[]} failures
 * @property {DuplicationSummary} summary
 */

/**
 * @param {DuplicationOptions} [options]
 * @returns {DuplicationResult}
 */
export function runJsDuplicationCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const functions = collectFunctions(viewerRoot);
  /** @type {Map<string, FunctionEntry[]>} */
  const byFingerprint = new Map();
  for (const fn of functions) {
    if (fn.size < MIN_FINGERPRINT_TOKENS) continue;
    let bucket = byFingerprint.get(fn.fingerprint);
    if (!bucket) {
      bucket = [];
      byFingerprint.set(fn.fingerprint, bucket);
    }
    bucket.push(fn);
  }

  const failures = [];
  for (const group of byFingerprint.values()) {
    const files = new Set(group.map((fn) => fn.rel));
    if (files.size < 2) continue;
    const locations = group.map((fn) => `${fn.rel}:${fn.line}`).join(", ");
    failures.push(
      `duplicate function body across files: ${locations}; ` +
        "extract one canonical helper under window.Polarrecorder and reuse it"
    );
  }
  failures.push(...duplicateBlockFailures(functions));
  failures.sort();

  const summary = {
    ok: failures.length === 0,
    checkedFunctions: functions.length,
    failures: failures.length
  };
  if (print) reportDuplication(failures);
  return { ok: summary.ok, failures, summary };
}

/**
 * @param {string[]} failures
 * @returns {void}
 */
function reportDuplication(failures) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[js-duplication] ${failure}`);
    console.error(`[js-duplication] ${failures.length} duplicate group(s) found.`);
    return;
  }
  console.log("JS duplication check passed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runJsDuplicationCheck().ok ? 0 : 1);
}
