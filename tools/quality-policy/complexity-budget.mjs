#!/usr/bin/env node

/**
 * Permanent complexity budget owner (`check:complexity`).
 *
 * Scans the live shipped JavaScript tree with `complexity-scan.mjs` and enforces the
 * strict 10/40/4/6 limits directly: every finding must be at or below its recorded active
 * `complexity-baseline.json` value (never above; shrinking requires updating the baseline
 * down in the same change), every baseline entry must still have a matching live finding
 * (a resolved entry must be removed, not left stale), and a finding with no baseline entry
 * fails outright -- new debt can never be baselined, only fixed. The active baseline
 * started (and, at every commit so far, remains) empty; there is no historical
 * exception path or Git-blob-derived debt ledger to reconcile against.
 */

import fs from "node:fs";
import path from "node:path";

import { STRICT_LIMITS, scanRepository } from "./complexity-scan.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");

/**
 * @param {string} root
 * @returns {string}
 */
function baselinePath(root) {
  return path.join(root, "tools", "quality-policy", "complexity-baseline.json");
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
 * @returns {boolean}
 */
function validateBaselineEntry(entry, index, out) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    out.push(`Invalid complexity baseline entry at index ${index}: expected an object.`);
    return false;
  }
  if (typeof entry.file !== "string" || !entry.file.trim()) {
    out.push(
      `Invalid complexity baseline entry at index ${index}: 'file' must be a non-empty string.`
    );
    return false;
  }
  if (typeof entry.identity !== "string" || !entry.identity.trim()) {
    out.push(
      `Invalid complexity baseline entry at index ${index}: 'identity' must be a non-empty string.`
    );
    return false;
  }
  if (!Object.prototype.hasOwnProperty.call(STRICT_LIMITS, entry.metric)) {
    out.push(
      `Invalid complexity baseline entry for '${entry.file}' ${entry.identity}: unknown metric '${entry.metric}'.`
    );
    return false;
  }
  const limit = /** @type {Record<string, number>} */ (STRICT_LIMITS)[entry.metric];
  if (!Number.isInteger(entry.value) || entry.value <= limit) {
    out.push(
      `Invalid complexity baseline entry for '${entry.file}' ${entry.identity}: '${entry.metric}' value must be an integer above ${limit}.`
    );
    return false;
  }
  if (entry.limit !== limit) {
    out.push(
      `Invalid complexity baseline entry for '${entry.file}' ${entry.identity}: '${entry.metric}' limit must be ${limit}.`
    );
    return false;
  }
  return true;
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
        `(limit ${finding.limit}); new debt cannot be baselined. Fix it to the strict limit.`
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

  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) {
    failures.push("Invalid complexity baseline: expected an object.");
  } else if (!Array.isArray(baseline.entries)) {
    failures.push("Invalid complexity baseline: 'entries' must be an array.");
  }
  const baselineEntries = Array.isArray(baseline?.entries) ? baseline.entries : [];

  /** @type {Map<string, any>} */
  const baselineByKey = new Map();
  baselineEntries.forEach((/** @type {any} */ entry, /** @type {number} */ index) => {
    if (!validateBaselineEntry(entry, index, failures)) return;
    const key = entryKey(entry);
    if (baselineByKey.has(key)) {
      failures.push(
        `Duplicate complexity-baseline entry: '${entry.file}' ${entry.identity} (${entry.metric}).`
      );
      return;
    }
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
