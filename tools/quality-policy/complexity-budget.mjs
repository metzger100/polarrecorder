#!/usr/bin/env node

/**
 * Permanent complexity budget owner (`check:complexity`).
 *
 * Verifies the immutable `complexity-findings-capture.json` still matches what
 * `baseline-complexity-capture.mjs` derives from the exact captured Git blobs, then checks
 * every live `complexity-baseline.json` entry against that immutable capture (an entry
 * may never exceed its frozen captured value -- new debt cannot be baselined, only fixed),
 * then scans the live shipped JavaScript tree with `complexity-scan.mjs` and requires every
 * finding to be at or below its recorded active-baseline value (never above; shrinking
 * requires updating the baseline down in the same change) and every baseline entry to
 * still have a matching live finding (a resolved entry must be removed, not left stale).
 *
 * Locks the debt set once, permanently, against the frozen capture -- unlike a checker that
 * grandfathers debt against a live-vs-git-blob diff every run, this owner never re-widens.
 */

import fs from "node:fs";
import path from "node:path";

import { STRICT_LIMITS, scanRepository } from "./complexity-scan.mjs";
import {
  captureHistoricalComplexity,
  verifyHistoricalComplexityCapture
} from "./baseline-complexity-capture.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

/**
 * @param {string} root
 * @returns {string}
 */
function baselinePath(root) {
  return path.join(root, "tools", "quality-policy", "complexity-baseline.json");
}

/**
 * @param {string} root
 * @returns {string}
 */
function findingsPath(root) {
  return path.join(root, "tools", "quality-policy", "complexity-findings-capture.json");
}

/**
 * @param {{file: string, identity: string, metric: string}} entry
 * @returns {string}
 */
function entryKey(entry) {
  return `${entry.file} ${entry.identity} ${entry.metric}`;
}

/**
 * @param {any} entry
 * @param {number} index
 * @param {string[]} out
 * @param {string} label
 * @returns {boolean}
 */
function validateBaselineEntry(entry, index, out, label) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    out.push(`Invalid ${label} entry at index ${index}: expected an object.`);
    return false;
  }
  if (typeof entry.file !== "string" || !entry.file.trim()) {
    out.push(`Invalid ${label} entry at index ${index}: 'file' must be a non-empty string.`);
    return false;
  }
  if (typeof entry.identity !== "string" || !entry.identity.trim()) {
    out.push(`Invalid ${label} entry at index ${index}: 'identity' must be a non-empty string.`);
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(STRICT_LIMITS, entry.metric)) {
    out.push(
      `Invalid ${label} entry for '${entry.file}' ${entry.identity}: unknown metric '${entry.metric}'.`
    );
    return false;
  }
  const limit = /** @type {Record<string, number>} */ (STRICT_LIMITS)[entry.metric];
  if (!Number.isInteger(entry.value) || entry.value <= limit) {
    out.push(
      `Invalid ${label} entry for '${entry.file}' ${entry.identity}: '${entry.metric}' value must be an integer above ${limit}.`
    );
    return false;
  }
  if (entry.limit !== limit) {
    out.push(
      `Invalid ${label} entry for '${entry.file}' ${entry.identity}: '${entry.metric}' limit must be ${limit}.`
    );
    return false;
  }
  return true;
}

/**
 * @param {any} entry
 * @param {any} historicalEntry
 * @param {string[]} out
 */
function checkHistoricalProvenance(entry, historicalEntry, out) {
  if (!historicalEntry) {
    out.push(
      `Unapproved complexity-baseline entry: '${entry.file}' ${entry.identity} (${entry.metric}) was not present ` +
        "in the immutable baseline capture. New debt must be fixed, not baselined."
    );
    return;
  }
  if (entry.value > historicalEntry.value) {
    out.push(
      `Invalid complexity-baseline increase: '${entry.file}' ${entry.identity} (${entry.metric}) exceeds the ` +
        `captured baseline value ${historicalEntry.value}.`
    );
  }
}

/**
 * @param {any} finding
 * @param {any} baselineEntry
 * @param {string[]} out
 */
function checkFinding(finding, baselineEntry, out) {
  if (!baselineEntry) {
    out.push(
      `New over-limit function: '${finding.file}' ${finding.identity} has ${finding.metric} ${finding.value} ` +
        `(limit ${finding.limit}); not in the immutable baseline debt set. Fix it to the strict limit.`
    );
    return;
  }
  if (finding.value > baselineEntry.value) {
    out.push(
      `Complexity regression: '${finding.file}' ${finding.identity} ${finding.metric} increased from baseline ` +
        `${baselineEntry.value} to ${finding.value} (limit ${finding.limit}).`
    );
  } else if (finding.value < baselineEntry.value) {
    out.push(
      `Complexity baseline can shrink: '${finding.file}' ${finding.identity} ${finding.metric} decreased from ` +
        `baseline ${baselineEntry.value} to ${finding.value} (limit ${finding.limit}); update the active baseline ` +
        "to the current value."
    );
  }
}

/**
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, failures: string[], baselineEntryCount: number}}
 */
export function runComplexityBudgetCheck(options = {}) {
  const root = options.root || ROOT;
  const print = options.print !== false;
  /** @type {string[]} */
  const failures = [];

  const baseline = JSON.parse(fs.readFileSync(baselinePath(root), "utf8"));
  const historical = JSON.parse(fs.readFileSync(findingsPath(root), "utf8"));

  if (root === ROOT) {
    try {
      verifyHistoricalComplexityCapture(historical, captureHistoricalComplexity());
    } catch (error) {
      failures.push(/** @type {Error} */ (error).message);
    }
  }

  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    failures.push("Invalid complexity baseline: expected an object.");
  } else if (!Array.isArray(baseline.entries)) {
    failures.push("Invalid complexity baseline: 'entries' must be an array.");
  }
  const baselineEntries = Array.isArray(baseline?.entries) ? baseline.entries : [];

  if (!historical || typeof historical !== "object" || Array.isArray(historical)) {
    failures.push("Invalid historical complexity capture: expected an object.");
  } else if (!Array.isArray(historical.findings)) {
    failures.push("Invalid historical complexity capture: 'findings' must be an array.");
  }
  const historicalEntries = Array.isArray(historical?.findings) ? historical.findings : [];

  /** @type {Map<string, any>} */
  const historicalByKey = new Map();
  historicalEntries.forEach((/** @type {any} */ entry, /** @type {number} */ index) => {
    if (!validateBaselineEntry(entry, index, failures, "historical complexity capture")) return;
    const key = entryKey(entry);
    if (historicalByKey.has(key)) {
      failures.push(
        `Duplicate historical complexity entry: '${entry.file}' ${entry.identity} (${entry.metric}).`
      );
      return;
    }
    historicalByKey.set(key, entry);
  });

  /** @type {Map<string, any>} */
  const baselineByKey = new Map();
  baselineEntries.forEach((/** @type {any} */ entry, /** @type {number} */ index) => {
    if (!validateBaselineEntry(entry, index, failures, "complexity baseline")) return;
    const key = entryKey(entry);
    if (baselineByKey.has(key)) {
      failures.push(
        `Duplicate complexity-baseline entry: '${entry.file}' ${entry.identity} (${entry.metric}).`
      );
      return;
    }
    checkHistoricalProvenance(entry, historicalByKey.get(key), failures);
    baselineByKey.set(key, entry);
  });

  const findings = scanRepository(root);
  const findingsByKey = new Map();
  for (const finding of findings) {
    findingsByKey.set(entryKey(finding), finding);
    checkFinding(finding, baselineByKey.get(entryKey(finding)), failures);
  }

  for (const [key, entry] of baselineByKey) {
    if (!findingsByKey.has(key)) {
      failures.push(
        `Stale complexity-baseline entry (already resolved, remove it): '${entry.file}' ${entry.identity} (${entry.metric}).`
      );
    }
  }

  if (print) {
    if (failures.length > 0) {
      for (const failure of failures) console.error(`[complexity-budget] ${failure}`);
    } else {
      console.log(
        `Complexity budget check passed: ${baselineByKey.size} tracked baseline entries, 0 new violations.`
      );
    }
  }
  return { ok: failures.length === 0, failures, baselineEntryCount: baselineByKey.size };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runComplexityBudgetCheck();
  process.exit(result.ok ? 0 : 1);
}
