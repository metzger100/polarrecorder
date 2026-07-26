#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

let ROOT = process.cwd();
let VIEWER_ROOT = path.join(ROOT, "viewer");
let SERVER_PACKAGE_ROOT = path.join(ROOT, "server", "polarrecorder");
const ROOT_JS_PATTERN_FILES = new Set(["plugin.js", "plugin.mjs"]);
// Machine-local home paths must never be committed in source or docs; they
// break on every other machine and leak the author's username.
const HOME_PATH = /(?:\/home\/[A-Za-z0-9_.-]+\/|\/Users\/[A-Za-z0-9_.-]+\/)/;
const ABSOLUTE_PATH_EXTENSIONS = new Set([
  ".md",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".sh",
  ".css",
  ".html",
  ".txt",
  ".yml",
  ".yaml"
]);
const EXEC_PLAN_REFERENCE_EXTENSIONS = new Set([
  ".md",
  ".js",
  ".mjs",
  ".cjs",
  ".py",
  ".json",
  ".jsonc",
  ".toml",
  ".sh",
  ".css",
  ".html",
  ".txt",
  ".yml",
  ".yaml"
]);
// tools/ and tests/ are in scope here (unlike ABSOLUTE_PATH_EXCLUDED_DIRS): this is
// exactly where historical exec-plan/phase citations leaked into permanent tooling and
// had to be removed after the fact.
const EXEC_PLAN_REFERENCE_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".vscode",
  "releases",
  "exec-plans",
  "venv",
  "__pycache__",
  "coverage"
]);
// A bare "PLANx.md" is a legitimate reference to a real historical exec-plan file (e.g.
// documenting that Ruff once wanted to reformat exec-plans/completed/PLAN1.md); anything
// else naming a plan or phase number is a citation that will go stale once the plan is
// archived, and must describe the code/config standalone instead.
const EXEC_PLAN_CITATION_PATTERN = /\bPLAN\d+\b(?!\.md)/;
const EXEC_PLAN_PHASE_PATTERN = /\bPhase\s?\d+[A-Za-z]?\b/;
const ROOT_MARKDOWN_FILES = new Set([
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
  "ROADMAP.md"
]);
const ABSOLUTE_PATH_INCLUDED_DOT_DIRS = new Set([".github", ".githooks"]);
// Generated, local-only, or developer-tooling trees are out of scope.
const ABSOLUTE_PATH_EXCLUDED_DIRS = new Set([
  "node_modules",
  ".git",
  ".claude",
  ".vscode",
  "tools",
  "tests",
  "releases",
  "exec-plans",
  "venv",
  "__pycache__",
  "coverage"
]);
const ABSOLUTE_PATH_EXCLUDED_FILES = new Set(["package-lock.json"]);
const CONFIG_DEFAULT_FIELDS = [
  "debug_logging",
  "enabled",
  "flush_interval_s",
  "max_rejection_ratio",
  "min_samples_for_export",
  "min_stw_ms",
  "percentile",
  "recording",
  "sample_interval_s",
  "startup_grace_s",
  "twa_jump_limit_deg",
  "twa_window_s",
  "tws_jump_limit_ms",
  "tws_window_s"
];
const CANVAS_METHODS = [
  "arc",
  "beginPath",
  "clearRect",
  "closePath",
  "fill",
  "fillRect",
  "fillText",
  "lineTo",
  "measureText",
  "moveTo",
  "restore",
  "rotate",
  "save",
  "scale",
  "setLineDash",
  "stroke",
  "strokeRect",
  "translate"
];

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

/** @type {string[]} */
let failures = [];
/** @type {RuleCounts} */
let byRule = Object.create(null);

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
 * Run every pattern rule against the repository (or a fake workspace root)
 * and return the aggregated result.
 * @param {PatternCheckOptions} [options] Root override and print toggle.
 * @returns {PatternCheckResult} Aggregated summary plus raw failure messages.
 */
export function runPatternCheck(options = {}) {
  setRoot(options.root || process.cwd());
  failures = [];
  byRule = Object.create(null);

  const viewerFiles = collectJavaScriptPatternFiles();
  const pythonFiles = collectPythonFiles(SERVER_PACKAGE_ROOT);
  for (const file of viewerFiles) {
    checkJavaScript(file);
  }
  for (const file of pythonFiles) {
    checkPython(file);
  }
  for (const file of collectAbsolutePathTargets()) {
    checkAbsolutePath(file);
  }
  for (const file of collectMarkdownTodoTargets()) {
    checkMarkdownTodos(file);
  }
  for (const file of collectExecPlanReferenceTargets()) {
    checkExecPlanReference(file);
  }

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
 * Point the module-level root globals at a (possibly fake) workspace root.
 * @param {string} root Absolute or relative workspace root path.
 * @returns {void}
 */
function setRoot(root) {
  ROOT = path.resolve(root);
  VIEWER_ROOT = path.join(ROOT, "viewer");
  SERVER_PACKAGE_ROOT = path.join(ROOT, "server", "polarrecorder");
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

// Generic JS rules (console.log, var, eval, bare isFinite, loose equality, ES-module
// syntax by scope, empty catch, unreferenced top-level function/constant-condition
// dead code, and lint-suppression comments) are ESLint's job (see eslint.config.mjs and
// tools/quality-policy/rule-parity-ledger.json). This checker keeps only the
// Polar-specific contracts ESLint cannot express: unsafe DOM sinks, commented-out code,
// owned TODO syntax, and the namespace/contract/config-default rules below.
/**
 * Run the per-line and whole-file JS pattern rules against one file.
 * @param {PatternFile} file Viewer or root JS file being scanned.
 * @returns {void}
 */
function checkJavaScript(file) {
  const content = fs.readFileSync(file.abs, "utf8");
  const lines = content.split(/\r?\n/);
  let commentedCodeRun = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const code = stripStrings(line);
    if (/\.innerHTML\s*=/.test(code))
      fail(file.rel, index, "innerHTML assignment is forbidden", "inner-html-assignment");

    if (/^\s*\/\//.test(line) && /[={}(]|\b(function|return)\b/.test(line)) {
      commentedCodeRun += 1;
      if (commentedCodeRun === 3) {
        fail(
          file.rel,
          index,
          "three or more consecutive commented-out code lines",
          "commented-out-code"
        );
      }
    } else {
      commentedCodeRun = 0;
    }
    checkTodo(file.rel, index, code);
  }
  checkCatchFallback(file, content);
  checkJsStructure(file, content);
}

// Whole-file structural rules ported from the dyninstruments check-patterns
// suite. These guard the general AI-agent regressions (dead code, stale
// fallback leftovers, speculative compat paths, defensive re-sanitizing, and
// truthy-default clobbering) that the per-line scan and ruff cannot see. They
// run over a copy with strings AND comments blanked so commented-out code is
// never counted as a real reference.
/**
 * Run the whole-file structural JS pattern rules over a comment-and-string
 * masked copy of the file (plus the raw content for the few config-boundary
 * rules that must still see literal `Polarrecorder.ConfigCache` text).
 * @param {PatternFile} file File being scanned.
 * @param {string} content Raw file contents.
 * @returns {void}
 */
function checkJsStructure(file, content) {
  const masked = maskCode(content);

  // default-truthy-fallback: 'x.default || fb' clobbers an explicit falsy
  // default ("", 0, false). Narrowly scoped to '.default ||' so legitimate
  // boundary defaulting on optional API fields (e.g. 'data.counters || {}')
  // is not flagged.
  scanJs(
    masked,
    file,
    /\b[A-Za-z_$][\w$.]*\.default\s*\|\|/g,
    () =>
      "default-truthy-fallback: '.default ||' clobbers explicit falsy defaults " +
      "(\"\", 0, false); use '??' or a presence check"
  );

  // redundant-null-type-guard: re-sanitizing a value the producer already
  // guarantees. Two narrow, proven shapes with no false positives on boundary
  // code.
  scanJs(
    masked,
    file,
    /\bArray\.isArray\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)\s*\?\s*\1\s*:\s*\[\s*\]/g,
    () =>
      "redundant-null-type-guard: 'Array.isArray(x) ? x : []' re-sanitizes a " +
      "guaranteed value; trust the producer contract"
  );
  scanJs(
    masked,
    file,
    /\bString\s*\(\s*\(?\s*([A-Za-z_$][\w$.]*)\s*==\s*null\s*\)?\s*\?\s*[^:]+:\s*\1\s*\)/g,
    () =>
      "redundant-null-type-guard: 'String(x == null ? ... : x)' re-sanitizes a " +
      "guaranteed value; trust the producer contract"
  );

  // promise-empty-catch: '.catch(function () {})' suppresses a rejected
  // Promise with no visible handling. Route it to a named handler, update UI
  // state, or convert the call to an action path that already owns errors.
  scanJs(
    masked,
    file,
    /\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{\s*\}\s*\)/g,
    () =>
      "promise-empty-catch: empty Promise catch swallows errors silently; route " +
      "the error to an existing handler or update visible state"
  );

  // hardcoded-runtime-default: viewer code must not duplicate config defaults
  // already produced by the API/config boundary. If the config was not loaded,
  // that is a caller-order bug rather than a place for a second default owner.
  scanJs(
    content,
    file,
    /\bPolarrecorder(?:\.ConfigCache|\["ConfigCache"\])\s*(?:\|\||\?\?)\s*\{\s*\}/g,
    () =>
      "hardcoded-runtime-default: ConfigCache is loaded before dependent UI; " +
      "do not duplicate config defaults downstream"
  );
  const configFields = CONFIG_DEFAULT_FIELDS.join("|");
  scanJs(
    masked,
    file,
    new RegExp(`\\bconfig\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`, "g"),
    (m) => `hardcoded-runtime-default: config.${m[1]} default is owned by the API/config boundary`
  );
  scanJs(
    masked,
    file,
    new RegExp(
      `\\bPolarrecorder(?:\\.ConfigCache|\\["ConfigCache"\\])\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`,
      "g"
    ),
    (m) =>
      `hardcoded-runtime-default: ConfigCache.${m[1]} default is owned by the API/config boundary`
  );
  checkConfigCacheLiteralAssignment(file, masked);
  checkPlaceholderLiterals(file, content);
  checkResponsiveHardFloors(file, masked);
  checkCanvasContractDrift(file, content, masked);

  // internal-namespace-fallback: calling an internal 'Polarrecorder.*' method
  // and immediately defaulting its result with '||' / '??' re-defaults a value
  // the namespace contract already guarantees. Boundary defaulting on optional
  // API fields ('data.counters || {}') is property access, not a namespace
  // call, so it stays allowed. The fallback *source* may still be a namespace
  // call (e.g. 'x || Polarrecorder.Presets.Fallback()'); only a guarded call on
  // the left of the operator is flagged, which paren-matching below enforces.
  checkInternalNamespaceFallback(file, masked);

  // framework-method-typeof-guard: internal namespace members are contract
  // owned. Runtime code may branch on object presence at optional boundaries,
  // but not type-check guaranteed methods before using them.
  scanJs(
    content,
    file,
    /typeof\s+Polarrecorder(?:\.[A-Za-z_$][\w$]*|\["[A-Za-z_$][\w$]*"])+\s*===\s*"function"/g,
    () =>
      "framework-method-typeof-guard: trust internal Polarrecorder method " +
      "contracts after module load"
  );

  // premature-legacy-support: a declaration named for speculative compat.
  // 'fallback' is intentionally excluded ('unused-fallback' covers stale
  // fallbacks; a wired fallback such as 'fallbackPresets' is legitimate).
  scanJs(masked, file, /\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/g, (m) =>
    /(legacy|compat|deprecated)/i.test(m[1])
      ? `premature-legacy-support: '${m[1]}' looks like a speculative legacy/` +
        "compat path; remove it unless an active boundary contract requires it"
      : null
  );

  // unused-fallback: a 'fallback'-named binding declared but never wired in
  // (declaration is the only reference) is a stale refactor leftover.
  const seenFallback = new Set();
  scanJs(masked, file, /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g, (m) => {
    const name = m[1];
    if (!/fallback/i.test(name) || seenFallback.has(name)) return null;
    seenFallback.add(name);
    if (countRefs(masked, name) > 1) return null;
    return (
      `unused-fallback: '${name}' is declared but never used; remove the ` +
      "stale fallback leftover or wire it into an active path"
    );
  });
}

/**
 * Flag `Polarrecorder.ConfigCache = { ... }` literal assignments, which
 * duplicate defaults already owned by the config/API boundary.
 * @param {PatternFile} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {void}
 */
function checkConfigCacheLiteralAssignment(file, masked) {
  const pattern = /\bPolarrecorder(?:\.ConfigCache|\["ConfigCache"\])\s*=\s*\{/g;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = pattern.exec(masked)) !== null) {
    const open = masked.indexOf("{", match.index + match[0].length - 1);
    if (open < 0) continue;
    const close = findMatchingBrace(masked, open);
    if (close < 0) continue;
    const index = masked.slice(0, match.index).split(/\r?\n/).length - 1;
    fail(
      file.rel,
      index,
      "hardcoded-runtime-default: Polarrecorder.ConfigCache literal duplicates API-owned " +
        "config defaults; surface the boundary failure instead",
      "hardcoded-runtime-default"
    );
  }
}

/**
 * Flag placeholder text literals ("No Data", "---", "N/A", ...) duplicated
 * outside their `Polarrecorder.Placeholders` owner.
 * @param {PatternFile} file File being scanned.
 * @param {string} content Raw file contents.
 * @returns {void}
 */
function checkPlaceholderLiterals(file, content) {
  const lines = content.split(/\r?\n/);
  const pattern = /(["'])(?:-{2,3}|N\/A|NO DATA|No Data|No data)\1/g;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/Polarrecorder\.Placeholders\s*=\s*Object\.freeze\s*\(\s*\{\s*NoData\s*:/.test(line)) {
      continue;
    }
    if (!pattern.test(line)) continue;
    pattern.lastIndex = 0;
    fail(
      file.rel,
      index,
      "placeholder-literal: placeholder text is owned by Polarrecorder.Placeholders; " +
        "reuse the namespace value instead of duplicating the literal",
      "placeholder-literal"
    );
  }
}

/**
 * Flag inline user-visible responsive floors (`Math.max(N, ...)` /
 * `clamp(..., N, ...)` with N >= 8) that should come from a shared owner.
 * @param {PatternFile} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {void}
 */
function checkResponsiveHardFloors(file, masked) {
  scanJs(masked, file, /\bMath\.max\s*\(\s*(\d+(?:\.\d+)?)\s*,/g, (m) =>
    Number(m[1]) >= 8
      ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
        "from a shared owner, not an inline Math.max literal"
      : null
  );
  scanJs(masked, file, /\bclamp\s*\([^,]+,\s*(\d+(?:\.\d+)?)\s*,/g, (m) =>
    Number(m[1]) >= 8
      ? "responsive-layout-hard-floor: user-visible layout/text floors must come " +
        "from a shared owner, not an inline clamp literal"
      : null
  );
}

/**
 * Flag Canvas 2D API contract drift: `typeof ctx.<method> === "function"`
 * guards on a validated context, and `try/finally`-wrapped internal
 * save/draw/restore sequences.
 * @param {PatternFile} file File being scanned.
 * @param {string} content Raw file contents.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {void}
 */
function checkCanvasContractDrift(file, content, masked) {
  const methods = CANVAS_METHODS.join("|");
  scanJs(
    content,
    file,
    new RegExp(`typeof\\s+[A-Za-z_$][\\w$]*\\.(${methods})\\s*===\\s*["']function["']`, "g"),
    (m) =>
      `canvas-api-typeof-guard: trust the validated Canvas 2D context; do not guard ctx.${m[1]} internally`
  );
  scanJs(
    masked,
    file,
    /try\s*\{[\s\S]{0,240}\bctx\.save\s*\([\s\S]{0,240}\bfinally\s*\{[\s\S]{0,160}\bctx\.restore\s*\(/g,
    () =>
      "try-finally-canvas-drawing: keep internal canvas save/draw/restore paths direct; " +
      "reserve try/finally for real boundary cleanup"
  );
}

/**
 * Run a regex over masked text; for each match, build() returns a message or
 * null to skip. Reports at the match's line using the shared fail() format.
 * @param {string} masked Comment-and-string masked (or raw) file contents to scan.
 * @param {PatternFile} file File being scanned, for failure reporting.
 * @param {RegExp} regex Global regex to iterate matches of.
 * @param {(match: RegExpExecArray) => (string | null)} build Builds a failure
 *   message for a match, or returns null to skip it.
 * @returns {void}
 */
function scanJs(masked, file, regex, build) {
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = regex.exec(masked)) !== null) {
    const message = build(match);
    if (message === null) continue;
    const index = masked.slice(0, match.index).split(/\r?\n/).length - 1;
    fail(file.rel, index, message, ruleNameFromMessage(message));
  }
}

/**
 * Extract the leading `rule-name:` token from a failure message built by a
 * scanJs() callback, so scanJs() itself does not need each rule name passed
 * separately.
 * @param {string} message Failure message produced by a scanJs() callback.
 * @returns {string} The rule id prefix, or "pattern" if none was found.
 */
function ruleNameFromMessage(message) {
  const match = /^([a-z0-9-]+):/.exec(message);
  return match ? match[1] : "pattern";
}

/**
 * Count word-boundary references to an identifier in masked text. A lone
 * declaration yields 1; any real use pushes the count above 1.
 * @param {string} masked Comment-and-string masked file contents.
 * @param {string} name Identifier to count references of.
 * @returns {number} Number of word-boundary occurrences of `name`.
 */
function countRefs(masked, name) {
  const matches = masked.match(new RegExp(`\\b${name}\\b`, "g"));
  return matches ? matches.length : 0;
}

// catch-fallback: a lexical try/catch whose body neither rethrows nor carries
// the structured boundary fallback marker silently swallows the error. Empty
// bodies are ESLint's `no-empty` (`allowEmptyCatch: false`); this targets the
// non-empty swallow that rule cannot see. The documented escape hatch is explicit:
// rethrow with 'throw' or add 'polarrecorder-boundary-fallback(<owner>):'.
/**
 * @param {PatternFile} file File being scanned.
 * @param {string} content Raw file contents.
 * @returns {void}
 */
function checkCatchFallback(file, content) {
  const masked = maskStringsOnly(content);
  const pattern = /(?<![.\w])catch\s*(?:\([^)]*\))?\s*\{/g;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = pattern.exec(masked)) !== null) {
    const open = masked.indexOf("{", match.index + match[0].length - 1);
    if (open < 0) continue;
    const close = findMatchingBrace(masked, open);
    if (close < 0) continue;
    const body = masked.slice(open + 1, close);
    if (body.trim() === "") continue; // empty -> empty-catch owns it
    if (/\bthrow\b/.test(body)) continue; // rethrows: not a swallow
    if (/polarrecorder-boundary-fallback\([^)]+\)\s*:/.test(body)) continue;
    const index = masked.slice(0, match.index).split(/\r?\n/).length - 1;
    fail(
      file.rel,
      index,
      "catch-fallback: catch block swallows the error and falls back silently; " +
        "rethrow it, route it to visible state, or mark the boundary fallback with " +
        "polarrecorder-boundary-fallback(<owner>):",
      "catch-fallback"
    );
  }
}

// internal-namespace-fallback: 'Polarrecorder.X.Helper(...) || fb' / '?? fb'.
// Walks each guarded namespace call with paren matching so nested-argument
// calls are handled and only an operator immediately after the call is flagged.
// The called member must be a PascalCase namespace export (a contract helper
// such as 'Presets.Fallback'); standard array/string methods on namespace-held
// data ('PresetsCache.find(...) || x') are lowercase and stay allowed.
/**
 * @param {PatternFile} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {void}
 */
function checkInternalNamespaceFallback(file, masked) {
  const head = /\bPolarrecorder(?:\.[A-Za-z_$][\w$]*|\["[A-Za-z_$][\w$]*"\])*\.[A-Z][\w$]*\s*\(/g;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = head.exec(masked)) !== null) {
    const open = masked.indexOf("(", match.index + match[0].length - 1);
    if (open < 0) continue;
    const close = findMatchingParen(masked, open);
    if (close < 0) continue;
    let cursor = close + 1;
    while (cursor < masked.length && /\s/.test(masked[cursor])) cursor += 1;
    const operator = masked.slice(cursor, cursor + 2);
    if (operator !== "||" && operator !== "??") continue;
    const index = masked.slice(0, match.index).split(/\r?\n/).length - 1;
    fail(
      file.rel,
      index,
      `internal-namespace-fallback: '${match[0].trim()}...) ${operator} ...' re-defaults ` +
        "an internal Polarrecorder contract result; trust the namespace and fail " +
        "loudly if the caller order is wrong",
      "internal-namespace-fallback"
    );
  }
}

/**
 * Return the index of the '}' that closes the '{' at openIndex, or -1.
 * @param {string} text Text to scan.
 * @param {number} openIndex Index of the opening '{'.
 * @returns {number} Index of the matching '}', or -1 if unmatched.
 */
function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/**
 * Return the index of the ')' that closes the '(' at openIndex, or -1.
 * @param {string} text Text to scan.
 * @param {number} openIndex Index of the opening '('.
 * @returns {number} Index of the matching ')', or -1 if unmatched.
 */
function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/**
 * @param {PatternFile} file Python file under `server/polarrecorder/` being scanned.
 * @returns {void}
 */
function checkPython(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (/^\s*(import|from)\s+avnav/.test(line))
      fail(file.rel, index, "AvNav import forbidden", "avnav-import");
    if (/^\s*import\s+pluginhandler\b/.test(line))
      fail(file.rel, index, "pluginhandler import forbidden", "pluginhandler-import");
    if (/^\s*from\s+plugin\s+import\b|^\s*import\s+plugin\b/.test(line)) {
      fail(file.rel, index, "plugin.py import forbidden", "reverse-plugin-import");
    }
    if (/\bthreading\.(Lock|RLock|Condition)\s*\(/.test(line)) {
      fail(
        file.rel,
        index,
        "threading lock acquisition forbidden in server/polarrecorder/",
        "domain-lock-acquisition"
      );
    }
    if (/\btime\.sleep\s*\(/.test(line))
      fail(file.rel, index, "time.sleep forbidden", "domain-time-sleep");
    checkPythonSuppression(file.rel, index, line);
    checkTodo(file.rel, index, line);
  }
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} line Raw source line.
 * @returns {void}
 */
function checkPythonSuppression(file, index, line) {
  const noqa = /#\s*noqa\b/i.exec(line);
  if (noqa) {
    const after = line.slice(noqa.index);
    const coded = /#\s*noqa\s*:\s*[A-Z]+[0-9]+(?:[,\s]+[A-Z]+[0-9]+)*/i.exec(after);
    if (!coded) {
      fail(
        file,
        index,
        "blanket '# noqa' is forbidden; use '# noqa: <CODES>  # <reason>'",
        "python-suppression"
      );
    } else if (!/#\s*\S/.test(after.slice(coded[0].length))) {
      fail(
        file,
        index,
        "'# noqa' must be justified with a trailing '# <reason>' comment",
        "python-suppression"
      );
    }
  }

  const typeIgnore = /#\s*type:\s*ignore\b/i.exec(line);
  if (typeIgnore) {
    const after = line.slice(typeIgnore.index);
    const coded = /#\s*type:\s*ignore\[[^\]]+\]/i.exec(after);
    if (!coded) {
      fail(
        file,
        index,
        "blanket '# type: ignore' is forbidden; use '# type: ignore[<code>]  # <reason>'",
        "python-suppression"
      );
    } else if (!/#\s*\S/.test(after.slice(coded.index + coded[0].length))) {
      fail(
        file,
        index,
        "'# type: ignore' must be justified with a trailing '# <reason>' comment",
        "python-suppression"
      );
    }
  }

  if (
    /#\s*ruff\s*:\s*noqa(?!\s*:)/i.test(line) ||
    /#\s*flake8\s*:\s*noqa\b/i.test(line) ||
    /#\s*mypy\s*:\s*ignore-errors\b/i.test(line)
  ) {
    fail(
      file,
      index,
      "file-level blanket suppression is forbidden; suppress specific codes with a reason",
      "python-suppression"
    );
  }
}

/**
 * @param {string} file Root-relative path of the file being scanned.
 * @param {number} index Zero-based line index.
 * @param {string} code Source line (or code with strings masked) to inspect.
 * @returns {void}
 */
function checkTodo(file, index, code) {
  const marker = /\b(TODO|FIXME)\b/.exec(code);
  if (!marker) return;
  if (!/\b(TODO|FIXME)\([A-Za-z][\w.-]*,\s*\d{4}-\d{2}-\d{2}\)\s*:/.test(code)) {
    fail(
      file,
      index,
      `${marker[1]} must use the format '${marker[1]}(owner, YYYY-MM-DD): ...'`,
      "unowned-todo"
    );
  }
}

/**
 * @param {PatternFile} file File being scanned for committed machine-local home paths.
 * @returns {void}
 */
function checkAbsolutePath(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const match = HOME_PATH.exec(lines[index]);
    if (match) {
      fail(
        file.rel,
        index,
        `absolute home path '${match[0]}' is forbidden; use a project-relative or redacted placeholder`,
        "absolute-home-path"
      );
    }
  }
}

/**
 * @param {PatternFile} file File being scanned for stale exec-plan/phase citations.
 * @returns {void}
 */
function checkExecPlanReference(file) {
  const lines = fs.readFileSync(file.abs, "utf8").split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = EXEC_PLAN_CITATION_PATTERN.exec(line) || EXEC_PLAN_PHASE_PATTERN.exec(line);
    if (match) {
      fail(
        file.rel,
        index,
        `'${match[0]}' cites a historical exec-plan/phase; describe the code or config standalone instead`,
        "exec-plan-reference"
      );
    }
  }
}

/**
 * @param {PatternFile} file Markdown file being scanned for unowned TODO/FIXME markers.
 * @returns {void}
 */
function checkMarkdownTodos(file) {
  const content = stripMarkdownCode(fs.readFileSync(file.abs, "utf8"));
  const lines = content.split(/\r?\n/);
  for (let index = 0; index < lines.length; index += 1) {
    const marker = /\b(TODO|FIXME)(?:\([^)]*\))?\s*:/.exec(lines[index]);
    if (!marker) continue;
    checkTodo(file.rel, index, lines[index]);
  }
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
function fail(file, zeroBasedLine, message, ruleName = "pattern") {
  if (!PATTERN_RULE_ID_SET.has(ruleName)) {
    throw new Error(`Unknown check-patterns rule '${ruleName}' for ${file}:${zeroBasedLine + 1}`);
  }
  byRule[ruleName] = (byRule[ruleName] || 0) + 1;
  failures.push(`${file}:${zeroBasedLine + 1}: ${message}`);
}

/**
 * @returns {PatternFile[]} Every file eligible for the absolute-home-path scan, sorted by path.
 */
function collectAbsolutePathTargets() {
  return collectFilesByExtension(ABSOLUTE_PATH_EXTENSIONS, ABSOLUTE_PATH_EXCLUDED_DIRS);
}

/**
 * @returns {PatternFile[]} Every file eligible for the exec-plan-reference scan, sorted by path.
 */
function collectExecPlanReferenceTargets() {
  return collectFilesByExtension(EXEC_PLAN_REFERENCE_EXTENSIONS, EXEC_PLAN_REFERENCE_EXCLUDED_DIRS);
}

/**
 * @param {Set<string>} extensions Allowed file extensions (with leading dot).
 * @param {Set<string>} excludedDirs Directory names to skip entirely.
 * @returns {PatternFile[]} Every matching file under ROOT, sorted by path.
 */
function collectFilesByExtension(extensions, excludedDirs) {
  /** @type {PatternFile[]} */
  const out = [];
  walkFilesByExtension(ROOT, extensions, excludedDirs, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current Directory being walked.
 * @param {Set<string>} extensions Allowed file extensions (with leading dot).
 * @param {Set<string>} excludedDirs Directory names to skip entirely.
 * @param {PatternFile[]} out Accumulator collecting discovered files.
 * @returns {void}
 */
function walkFilesByExtension(current, extensions, excludedDirs, out) {
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (entry.name.startsWith(".") && !ABSOLUTE_PATH_INCLUDED_DOT_DIRS.has(entry.name)) continue;
      if (excludedDirs.has(entry.name)) continue;
      walkFilesByExtension(path.join(current, entry.name), extensions, excludedDirs, out);
    } else if (entry.isFile()) {
      if (ABSOLUTE_PATH_EXCLUDED_FILES.has(entry.name)) continue;
      if (!extensions.has(path.extname(entry.name))) continue;
      const abs = path.join(current, entry.name);
      out.push({ abs, rel: toRel(abs) });
    }
  }
}

/**
 * @returns {PatternFile[]} Every `viewer/*.js` file plus the root JS entrypoints
 *   (`plugin.js`, `plugin.mjs`) that exist, sorted by path.
 */
function collectJavaScriptPatternFiles() {
  const out = collectViewerJsFiles();
  for (const name of ROOT_JS_PATTERN_FILES) {
    const abs = path.join(ROOT, name);
    if (fs.existsSync(abs)) {
      out.push({ abs, rel: name });
    }
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @returns {PatternFile[]} Every `viewer/*.js` file, or an empty array if the viewer directory
 *   does not exist.
 */
function collectViewerJsFiles() {
  if (!fs.existsSync(VIEWER_ROOT)) return [];
  return fs
    .readdirSync(VIEWER_ROOT)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({
      abs: path.join(VIEWER_ROOT, name),
      rel: `viewer/${name}`
    }));
}

/**
 * @returns {PatternFile[]} Every `documentation/**\/*.md` file plus the tracked root
 *   Markdown files that exist, sorted by path.
 */
function collectMarkdownTodoTargets() {
  /** @type {PatternFile[]} */
  const out = [];
  const docRoot = path.join(ROOT, "documentation");
  if (fs.existsSync(docRoot)) walkMarkdownTodoTargets(docRoot, out);
  for (const rel of ROOT_MARKDOWN_FILES) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) out.push({ abs, rel });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current File or directory being walked.
 * @param {PatternFile[]} out Accumulator collecting discovered Markdown files.
 * @returns {void}
 */
function walkMarkdownTodoTargets(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".md")) out.push({ abs: current, rel: toRel(current) });
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    walkMarkdownTodoTargets(path.join(current, entry.name), out);
  }
}

/**
 * @param {string} start Directory to search (`server/polarrecorder/`).
 * @returns {PatternFile[]} Every `.py` file under `start`, sorted by path, or an
 *   empty array if `start` does not exist.
 */
function collectPythonFiles(start) {
  if (!fs.existsSync(start)) return [];
  /** @type {PatternFile[]} */
  const out = [];
  walkPython(start, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} current File or directory being walked.
 * @param {PatternFile[]} out Accumulator collecting discovered Python files.
 * @returns {void}
 */
function walkPython(current, out) {
  const stat = fs.statSync(current);
  if (stat.isFile()) {
    if (current.endsWith(".py")) out.push({ abs: current, rel: toRel(current) });
    return;
  }
  for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
    walkPython(path.join(current, entry.name), out);
  }
}

/**
 * @param {string} line Single source line.
 * @returns {string} The line with string literal bodies replaced by `""`.
 */
function stripStrings(line) {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
}

// Replace string contents with spaces while leaving comments and newlines
// intact. Comments are recognised (so quotes inside them do not open a string)
// but not blanked, so a comment inside a catch block still defeats the
// empty-catch match.
/**
 * @param {string} content Raw file contents.
 * @returns {string} Contents with string literal bodies blanked to spaces.
 */
function maskStringsOnly(content) {
  const chars = [...content];
  let mode = "code";
  let quote = "";
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        while (i < chars.length && chars[i] !== "\n") i += 1;
        i -= 1;
      } else if (char === "/" && next === "*") {
        i += 2;
        while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) i += 1;
        i += 1;
      } else if (char === '"' || char === "'" || char === "`") {
        mode = "string";
        quote = char;
      }
    } else if (char === "\\") {
      chars[i] = " ";
      if (i + 1 < chars.length && chars[i + 1] !== "\n") {
        chars[i + 1] = " ";
        i += 1;
      }
    } else if (char === quote) {
      mode = "code";
      quote = "";
    } else if (char !== "\n") {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

// Replace BOTH string contents and comment bodies with spaces (newlines kept)
// so that structural rules count only real code. Unlike maskStringsOnly, this
// blanks comments too, so commented-out code never registers as a reference.
/**
 * @param {string} content Raw file contents.
 * @returns {string} Contents with string literal and comment bodies blanked to spaces.
 */
function maskCode(content) {
  const chars = [...content];
  let mode = "code";
  let quote = "";
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        while (i < chars.length && chars[i] !== "\n") {
          chars[i] = " ";
          i += 1;
        }
        i -= 1;
      } else if (char === "/" && next === "*") {
        while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) {
          if (chars[i] !== "\n") chars[i] = " ";
          i += 1;
        }
        if (i < chars.length) {
          chars[i] = " ";
          chars[i + 1] = " ";
          i += 1;
        }
      } else if (char === '"' || char === "'" || char === "`") {
        mode = "string";
        quote = char;
      }
    } else if (char === "\\") {
      chars[i] = " ";
      if (i + 1 < chars.length && chars[i + 1] !== "\n") {
        chars[i + 1] = " ";
        i += 1;
      }
    } else if (char === quote) {
      mode = "code";
      quote = "";
    } else if (char !== "\n") {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * @param {string} content Raw Markdown file contents.
 * @returns {string} Contents with fenced code blocks and inline code spans blanked.
 */
function stripMarkdownCode(content) {
  const lines = content.split(/\r?\n/);
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```+|~~~+)/.test(line)) {
      inFence = !inFence;
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line.replace(/`[^`\n]*`/g, ""));
  }
  return out.join("\n");
}

/**
 * @param {string} absolutePath Absolute path under `ROOT`.
 * @returns {string} Forward-slash-separated path relative to `ROOT`.
 */
function toRel(absolutePath) {
  return path.relative(ROOT, absolutePath).replace(/\\/g, "/");
}
