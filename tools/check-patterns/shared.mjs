import path from "node:path";

/**
 * @typedef {{abs: string, rel: string}} PatternFile
 * A discovered file paired with its absolute path and its root-relative,
 * forward-slash-separated path used in failure messages.
 */

/**
 * @typedef {{root?: string, print?: boolean}} PatternCheckOptions
 */

/**
 * @typedef {Record<string, number>} RuleCounts
 */

/**
 * @typedef {{
 *   ok: boolean,
 *   checkedJsFiles: number,
 *   checkedPythonFiles: number,
 *   failures: number,
 *   byRule: RuleCounts
 * }} PatternSummary
 */

/**
 * @typedef {{summary: PatternSummary, failures: string[]}} PatternCheckResult
 */

export let ROOT = process.cwd();
export let VIEWER_ROOT = path.join(ROOT, "viewer");
export let SERVER_PACKAGE_ROOT = path.join(ROOT, "server", "polarrecorder");

/** @type {string[]} */
export let failures = [];
/** @type {RuleCounts} */
export let byRule = Object.create(null);

export const PATTERN_RULE_IDS = [
  "absolute-home-path",
  "avnav-import",
  "canvas-api-typeof-guard",
  "catch-fallback",
  "commented-out-code",
  "default-truthy-fallback",
  "domain-lock-acquisition",
  "domain-time-sleep",
  "exec-plan-reference",
  "framework-method-typeof-guard",
  "hardcoded-runtime-default",
  "inner-html-assignment",
  "internal-namespace-fallback",
  "no-nul-byte",
  "placeholder-literal",
  "pluginhandler-import",
  "premature-legacy-support",
  "promise-empty-catch",
  "python-suppression",
  "redundant-null-type-guard",
  "responsive-layout-hard-floor",
  "reverse-plugin-import",
  "try-finally-canvas-drawing",
  "unowned-todo",
  "unused-fallback"
];
const PATTERN_RULE_ID_SET = new Set(PATTERN_RULE_IDS);

/**
 * Point the module-level root globals at a (possibly fake) workspace root and
 * reset the shared failure accumulators for a fresh run.
 * @param {string} root Absolute or relative workspace root path.
 * @returns {void}
 */
export function setRoot(root) {
  ROOT = path.resolve(root);
  VIEWER_ROOT = path.join(ROOT, "viewer");
  SERVER_PACKAGE_ROOT = path.join(ROOT, "server", "polarrecorder");
  failures = [];
  byRule = Object.create(null);
}

/**
 * Record one rule failure against the shared module-level `failures` and
 * `byRule` accumulators.
 * @param {string} file Root-relative path of the offending file.
 * @param {number} zeroBasedLine Zero-based line index of the offense.
 * @param {string} message Human-readable failure message.
 * @param {string} [ruleName] One of `PATTERN_RULE_IDS`; defaults to "pattern".
 * @returns {void}
 */
export function fail(file, zeroBasedLine, message, ruleName = "pattern") {
  if (!PATTERN_RULE_ID_SET.has(ruleName)) {
    throw new Error(`Unknown check-patterns rule '${ruleName}' for ${file}:${zeroBasedLine + 1}`);
  }
  byRule[ruleName] = (byRule[ruleName] || 0) + 1;
  failures.push(`${file}:${zeroBasedLine + 1}: ${message}`);
}

/**
 * @param {string} absolutePath Absolute path under `ROOT`.
 * @returns {string} Forward-slash-separated path relative to `ROOT`.
 */
export function toRel(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, "/");
}
