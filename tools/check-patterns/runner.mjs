#!/usr/bin/env node

/**
 * @file Product-neutral pattern runner over a caller-provided rule registry.
 * Documentation: documentation/conventions/quality-gates.md
 */

import path from "node:path";
import {
  compareFindings,
  filesForScope,
  getWarnMode,
  isLintSuppressed,
  resetContext,
  setKnownRuleNames
} from "./shared.mjs";
import { runRegexRule } from "./rules-core.mjs";

/** @typedef {import("./shared.mjs").Finding} Finding */
/** @typedef {import("./shared.mjs").Rule} Rule */
/** @typedef {{file: string, line: number, rule: string, owner: string, reason: string}} ConfiguredException */

/**
 * @param {{root?: string, warnMode?: boolean, print?: boolean, rules: Rule[], configuredExceptions?: ConfiguredException[]}} options
 * @returns {{summary: any, findings: Finding[], warnings: Finding[], failures: string[]}}
 */
export function runPatternCheck(options) {
  validateConfiguredExceptions(options.configuredExceptions || []);
  resetContext({
    root: path.resolve(options.root || process.cwd()),
    warnMode: !!options.warnMode
  });
  setKnownRuleNames(options.rules.map((rule) => rule.name));

  /** @type {Finding[]} */
  const findings = [];
  /** @type {Finding[]} */
  const warnings = [];
  const checkedFiles = new Set();
  /** @type {Record<string, number>} */
  const byRule = {};
  /** @type {Record<string, number>} */
  const byRuleFailures = {};
  /** @type {Record<string, number>} */
  const byRuleWarnings = {};
  for (const rule of options.rules) {
    const files = filesForScope(rule.scope);
    for (const file of files) checkedFiles.add(file);
    const run = rule.run || runRegexRule;
    const ruleFindings = run(rule, files)
      .map(function (/** @type {Finding} */ finding) {
        const severity = finding.severity || rule.severity || "block";
        return { ...finding, severity };
      })
      .filter(function (/** @type {Finding} */ finding) {
        if (rule.name === "invalid-lint-suppression") return true;
        return (
          !isLintSuppressed(finding.file, finding.line, rule.name) &&
          !isConfiguredException(options.configuredExceptions || [], finding, rule.name)
        );
      })
      .sort(compareFindings);
    byRule[rule.name] = ruleFindings.length;
    const ruleFailures = ruleFindings.filter((/** @type {Finding} */ finding) => finding.severity === "block");
    const ruleWarns = ruleFindings.filter((/** @type {Finding} */ finding) => finding.severity === "warn");
    byRuleFailures[rule.name] = ruleFailures.length;
    byRuleWarnings[rule.name] = ruleWarns.length;
    findings.push(...ruleFailures);
    warnings.push(...ruleWarns);
  }

  const summary = {
    ok: findings.length === 0,
    warnMode: getWarnMode(),
    checkedFiles: checkedFiles.size,
    failures: findings.length,
    warnings: warnings.length,
    byRule,
    byRuleFailures,
    byRuleWarnings
  };
  if (options.print !== false) printResult(findings, warnings, summary);
  return {
    summary,
    findings,
    warnings,
    failures: findings.map((finding) => `${finding.file}:${finding.line}: ${finding.message}`)
  };
}

/** @param {ConfiguredException[]} exceptions @param {Finding} finding @param {string} ruleName @returns {boolean} */
function isConfiguredException(exceptions, finding, ruleName) {
  return exceptions.some(
    (exception) => exception.file === finding.file && exception.line === finding.line && exception.rule === ruleName
  );
}

/** @param {ConfiguredException[]} exceptions @returns {void} */
function validateConfiguredExceptions(exceptions) {
  if (!Array.isArray(exceptions)) throw new Error("Configured pattern exceptions must be an array.");
  for (const exception of exceptions) {
    if (!exception || typeof exception !== "object") throw new Error("Configured pattern exception must be an object.");
    if (
      typeof exception.file !== "string" ||
      !exception.file ||
      exception.file.startsWith("/") ||
      exception.file.includes("..") ||
      !Number.isInteger(exception.line) ||
      exception.line < 1 ||
      typeof exception.rule !== "string" ||
      !exception.rule ||
      typeof exception.owner !== "string" ||
      !exception.owner ||
      typeof exception.reason !== "string" ||
      !exception.reason
    ) {
      throw new Error(`Invalid configured pattern exception for '${exception.file || "unknown"}'.`);
    }
  }
}

/** @param {Finding[]} findings @param {Finding[]} warnings @param {any} summary @returns {void} */
function printResult(findings, warnings, summary) {
  for (const warning of warnings) console.log(warning.message);
  const print = getWarnMode() ? console.log : console.error;
  for (const finding of findings) print(finding.message);
  if (findings.length || warnings.length) print("SUMMARY_JSON=" + JSON.stringify(summary));
  else {
    console.log("Pattern check passed.");
    console.log("SUMMARY_JSON=" + JSON.stringify(summary));
  }
}
