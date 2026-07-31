#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  compareFindings,
  filesForScope,
  getWarnMode,
  isLintSuppressed,
  resetContext
} from "./check-patterns/shared.mjs";
import { setKnownRuleNames } from "./check-patterns/shared-suppressions.mjs";
import { RULES, runRegexRule } from "./check-patterns/rules.mjs";

export const PATTERN_RULE_IDS = Object.freeze(RULES.map((rule) => rule.name));
export { RULES };

/** @typedef {import("./check-patterns/shared.mjs").Finding} Finding */
/** @typedef {{root?: string, warnMode?: boolean, print?: boolean}} PatternCheckOptions */
/**
 * @typedef {{
 *   ok: boolean,
 *   warnMode: boolean,
 *   checkedFiles: number,
 *   checkedJsFiles: number,
 *   checkedPythonFiles: number,
 *   failures: number,
 *   warnings: number,
 *   byRule: Record<string, number>
 * }} PatternSummary
 */
/** @typedef {{summary: PatternSummary, findings: Finding[], warnings: Finding[], failures: string[]}} PatternCheckResult */

/**
 * Run every declarative rule in `RULES` against the repository (or a fake
 * workspace root) and return the aggregated result. Each rule's severity
 * defaults to "block"; a "warn" finding is reported but never fails the gate
 * unless the whole run is invoked with `--warn` demoted globally by the
 * caller (kept for parity with the donated engine's `--warn` exploratory
 * mode, which relaxes every "block" finding to a warning for one run).
 * @param {PatternCheckOptions & {ruleNames?: string[]}} [options]
 * @returns {PatternCheckResult}
 */
export function runPatternCheck(options = {}) {
  resetContext({ root: path.resolve(options.root || process.cwd()), warnMode: !!options.warnMode });
  setKnownRuleNames(RULES.map((rule) => rule.name));

  /** @type {Finding[]} */
  const findings = [];
  /** @type {Finding[]} */
  const warnings = [];
  /** @type {Set<string>} */
  const checkedFiles = new Set();
  /** @type {Record<string, number>} */
  const byRule = {};

  const selectedRules = options.ruleNames ? RULES.filter((rule) => options.ruleNames?.includes(rule.name)) : RULES;
  for (const rule of selectedRules) {
    const files = filesForScope(rule.scope);
    for (const file of files) checkedFiles.add(file);
    const run = rule.run || runRegexRule;
    const ruleFindings = run(rule, files)
      .filter(
        (finding) =>
          rule.name === "invalid-lint-suppression" || !isLintSuppressed(finding.file, finding.line, rule.name)
      )
      .sort(compareFindings);
    byRule[rule.name] = (byRule[rule.name] || 0) + ruleFindings.length;

    const demoteToWarn = getWarnMode() || rule.severity === "warn";
    for (const finding of ruleFindings) {
      if (demoteToWarn) warnings.push(finding);
      else findings.push(finding);
    }
  }

  const checkedJsFiles = [...checkedFiles].filter((f) => f.endsWith(".js") || f.endsWith(".mjs")).length;
  const checkedPythonFiles = [...checkedFiles].filter((f) => f.endsWith(".py")).length;

  const summary = {
    ok: findings.length === 0,
    warnMode: getWarnMode(),
    checkedFiles: checkedFiles.size,
    checkedJsFiles,
    checkedPythonFiles,
    failures: findings.length,
    warnings: warnings.length,
    byRule
  };

  if (options.print !== false) printSummary(summary, findings, warnings);

  return {
    summary,
    findings,
    warnings,
    failures: findings.map((finding) => `${finding.file}:${finding.line}: ${finding.message}`)
  };
}

/**
 * CLI entry point: run the full check against the real working directory and
 * exit with a non-zero status on failure. `--warn` demotes every "block"
 * finding to a warning for exploratory runs; the process still exits 0.
 * @returns {void}
 */
function runPatternCheckCli() {
  const warnMode = process.argv.includes("--warn");
  const only = process.argv.find((arg) => arg.startsWith("--only="));
  const ruleNames = only ? only.slice("--only=".length).split(",").filter(Boolean) : undefined;
  const result = runPatternCheck({ root: process.cwd(), warnMode, ruleNames, print: true });
  process.exit(result.summary.ok ? 0 : 1);
}

/**
 * @param {PatternSummary} summary
 * @param {Finding[]} findings
 * @param {Finding[]} warnings
 * @returns {void}
 */
function printSummary(summary, findings, warnings) {
  for (const warning of warnings) console.warn(`[patterns:warn] ${warning.file}:${warning.line}: ${warning.message}`);
  if (findings.length > 0) {
    for (const finding of findings) console.error(`[patterns] ${finding.file}:${finding.line}: ${finding.message}`);
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
