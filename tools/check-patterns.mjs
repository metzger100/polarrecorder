#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import { byRule, failures, setRoot, PATTERN_RULE_IDS } from "./check-patterns/shared.mjs";
import { resetFileCache } from "./check-patterns/file-cache.mjs";
import { RULES } from "./check-patterns/rules.mjs";
import { collectJavaScriptPatternFiles, collectPythonFiles } from "./check-patterns/discovery.mjs";

export { PATTERN_RULE_IDS, RULES };

/**
 * @typedef {import("./check-patterns/shared.mjs").PatternCheckOptions} PatternCheckOptions
 * @typedef {import("./check-patterns/shared.mjs").PatternSummary} PatternSummary
 * @typedef {import("./check-patterns/shared.mjs").PatternCheckResult} PatternCheckResult
 * @typedef {import("./check-patterns/shared.mjs").PatternFile} PatternFile
 */

/**
 * Run every declarative rule in `RULES` against the repository (or a fake
 * workspace root) and return the aggregated result. Each rule's `scope.key`
 * is resolved to a file list at most once per run and shared by every rule
 * registered against that scope.
 * @param {PatternCheckOptions} [options] Root override and print toggle.
 * @returns {PatternCheckResult} Aggregated summary plus raw failure messages.
 */
export function runPatternCheck(options = {}) {
  setRoot(options.root || process.cwd());
  resetFileCache();

  /** @type {Map<string, PatternFile[]>} */
  const scopeFiles = new Map();
  /**
   * @param {import("./check-patterns/shared.mjs").RuleScope} scope
   * @returns {PatternFile[]}
   */
  function filesForScope(scope) {
    if (!scopeFiles.has(scope.key)) scopeFiles.set(scope.key, scope.collect());
    return /** @type {PatternFile[]} */ (scopeFiles.get(scope.key));
  }

  for (const rule of RULES) {
    rule.run(rule, filesForScope(rule.scope));
  }

  const viewerFiles = collectJavaScriptPatternFiles();
  const pythonFiles = collectPythonFiles();
  const summary = {
    ok: failures.length === 0,
    checkedJsFiles: viewerFiles.length,
    checkedPythonFiles: pythonFiles.length,
    failures: failures.length,
    byRule
  };

  if (options.print !== false) {
    printSummary(summary);
  }

  return { summary, failures: failures.slice() };
}

/**
 * CLI entry point: run the full check against the real working directory and
 * exit with a non-zero status on failure.
 * @returns {void}
 */
function runPatternCheckCli() {
  const result = runPatternCheck({ root: process.cwd(), print: true });
  process.exit(result.summary.ok ? 0 : 1);
}

/**
 * Print failures (or the success line) plus a machine-readable summary line.
 * @param {PatternSummary} summary Aggregated run summary.
 * @returns {void}
 */
function printSummary(summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[patterns] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Pattern check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

/**
 * Detect whether this module was invoked directly as a script (rather than
 * imported by a test), so the CLI runner only fires on direct invocation.
 * @returns {boolean} True if this file is the process entry point.
 */
function isCliEntrypoint() {
  if (!process.argv[1]) return false;
  return pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
}

if (isCliEntrypoint()) {
  runPatternCheckCli();
}
