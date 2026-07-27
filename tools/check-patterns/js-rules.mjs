import fs from "node:fs";

import { fail } from "./shared.mjs";
import { countRefs, findMatchingBrace, maskCode, scanJs, stripStrings } from "./source-scan.mjs";
import { checkTodo } from "./cross-file-rules.mjs";
import { checkCatchFallback, checkInternalNamespaceFallback } from "./js-rules-fallback.mjs";

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

// Generic JS rules (console.log, var, eval, bare isFinite, loose equality, ES-module
// syntax by scope, empty catch, unreferenced top-level function/constant-condition
// dead code, and lint-suppression comments) are ESLint's job (see eslint.config.mjs).
// This checker keeps only the Polar-specific contracts ESLint cannot express: unsafe DOM
// sinks, commented-out code, owned TODO syntax, and the namespace/contract/config-default
// rules below.
/**
 * Run the per-line and whole-file JS pattern rules against one file.
 * @param {import("./shared.mjs").PatternFile} file Viewer or root JS file being scanned.
 * @returns {void}
 */
export function checkJavaScript(file) {
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
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
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
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
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
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
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
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
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
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
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
