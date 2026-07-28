import path from "node:path";

/**
 * @typedef {{abs: string, rel: string}} PatternFile
 * A discovered file paired with its absolute path and its root-relative,
 * forward-slash-separated path used in failure messages.
 */

/**
 * @typedef {{key: string, collect: () => PatternFile[]}} RuleScope
 * A named file-discovery function a rule runs over. `key` only disambiguates
 * rule-registry entries that intentionally share one canonical rule `name`
 * across more than one scope (e.g. `todo-without-owner` across JS, Python, and
 * Markdown); it has no effect on file discovery itself.
 */

/**
 * @typedef {{content: string, lines: string[], masked: string, maskedStringsOnly: string}} FileData
 * Cached per-file text views computed once and reused by every rule that
 * scans the same file: raw content, its line split, comment-and-string
 * masked text, and string-only masked text.
 */

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   severity: "block",
 *   scope: RuleScope,
 *   run: (rule: Rule, files: PatternFile[]) => void,
 *   [key: string]: any
 * }} Rule
 * A declarative pattern-rule entry. `run` performs the scan and reports
 * findings itself via `fail()`; `id` is unique per registry entry, `name` is
 * the reported (and `PATTERN_RULE_IDS`-listed) rule identifier.
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
  "invalid-lint-suppression",
  "namespace-token-consistency",
  "no-nul-byte",
  "placeholder-literal",
  "pluginhandler-import",
  "premature-legacy-support",
  "promise-empty-catch",
  "redundant-null-type-guard",
  "responsive-layout-hard-floor",
  "reverse-plugin-import",
  "todo-without-owner",
  "try-finally-canvas-drawing",
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
 * Build the suppression marker text for a rule name, e.g. `pattern-ignore:
 * absolute-home-path`. This is the generic, engine-level suppression
 * convention every declarative rule may honor; rule-specific escape hatches
 * (such as `catch-fallback`'s `polarrecorder-boundary-fallback(<owner>):`)
 * remain separate and are not replaced by this.
 * @param {string} ruleName Rule identifier being suppressed.
 * @returns {string} The exact marker text to search a line for.
 */
export function suppressionMarker(ruleName) {
  return `pattern-ignore: ${ruleName}`;
}

/**
 * Whether a finding at `zeroBasedLine` is suppressed by a `pattern-ignore:
 * <ruleName>` comment on that line or the line immediately above it.
 * @param {string[]} lines File split into lines.
 * @param {number} zeroBasedLine Zero-based line index of the offense.
 * @param {string} ruleName Rule identifier to check suppression for.
 * @returns {boolean} True if the finding is suppressed.
 */
export function isSuppressed(lines, zeroBasedLine, ruleName) {
  const marker = suppressionMarker(ruleName);
  const here = lines[zeroBasedLine];
  const above = zeroBasedLine > 0 ? lines[zeroBasedLine - 1] : undefined;
  return (here !== undefined && here.includes(marker)) || (above !== undefined && above.includes(marker));
}

/**
 * Record one rule failure against the shared module-level `failures` and
 * `byRule` accumulators, unless a `pattern-ignore: <ruleName>` comment on the
 * offending line or the line above suppresses it (only checked when `lines`
 * is supplied).
 * @param {string} file Root-relative path of the offending file.
 * @param {number} zeroBasedLine Zero-based line index of the offense.
 * @param {string} message Human-readable failure message.
 * @param {string} [ruleName] One of `PATTERN_RULE_IDS`; defaults to "pattern".
 * @param {string[]} [lines] Offending file split into lines, to honor the
 *   generic `pattern-ignore:` suppression convention. Omit to skip the check.
 * @returns {void}
 */
export function fail(file, zeroBasedLine, message, ruleName = "pattern", lines) {
  if (!PATTERN_RULE_ID_SET.has(ruleName)) {
    throw new Error(`Unknown check-patterns rule '${ruleName}' for ${file}:${zeroBasedLine + 1}`);
  }
  if (lines && isSuppressed(lines, zeroBasedLine, ruleName)) return;
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
