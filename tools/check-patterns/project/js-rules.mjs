import { fail } from "../shared.mjs";
import { getFileData } from "../file-cache.mjs";
import { findMatchingBrace, findMatchingParen, scanJs } from "../source-scan.mjs";
import { collectJavaScriptPatternFiles } from "../discovery.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").PatternFile} PatternFile
 */

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

const JS_SCOPE = { key: "js-all", collect: collectJavaScriptPatternFiles };

// catch-fallback: a lexical try/catch whose body neither rethrows nor carries
// the structured boundary fallback marker silently swallows the error. Empty
// bodies are ESLint's `no-empty`; this targets the non-empty swallow that rule
// cannot see. The documented escape hatch is explicit: rethrow with 'throw' or
// add 'polarrecorder-boundary-fallback(<owner>):'.
/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runCatchFallback(files) {
  for (const file of files) {
    const { maskedStringsOnly: masked, lines } = getFileData(file);
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
        "catch-fallback",
        lines
      );
    }
  }
}

// internal-namespace-fallback: 'Polarrecorder.X.Helper(...) || fb' / '?? fb'.
// Walks each guarded namespace call with paren matching so nested-argument
// calls are handled and only an operator immediately after the call is
// flagged. Standard array/string methods on namespace-held data stay allowed
// because the called member must be a PascalCase namespace export.
/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runInternalNamespaceFallback(files) {
  for (const file of files) {
    const { masked, lines } = getFileData(file);
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
        "internal-namespace-fallback",
        lines
      );
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runHardcodedRuntimeDefault(files) {
  const configFields = CONFIG_DEFAULT_FIELDS.join("|");
  for (const file of files) {
    const { content, masked, lines } = getFileData(file);
    scanJs(
      content,
      file,
      /\bPolarrecorder(?:\.ConfigCache|\["ConfigCache"\])\s*(?:\|\||\?\?)\s*\{\s*\}/g,
      () =>
        "hardcoded-runtime-default: ConfigCache is loaded before dependent UI; " +
        "do not duplicate config defaults downstream",
      lines
    );
    scanJs(
      masked,
      file,
      new RegExp(`\\bconfig\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`, "g"),
      (m) => `hardcoded-runtime-default: config.${m[1]} default is owned by the API/config boundary`,
      lines
    );
    scanJs(
      masked,
      file,
      new RegExp(
        `\\bPolarrecorder(?:\\.ConfigCache|\\["ConfigCache"\\])\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`,
        "g"
      ),
      (m) => `hardcoded-runtime-default: ConfigCache.${m[1]} default is owned by the API/config boundary`,
      lines
    );
    runConfigCacheLiteralAssignment(file, masked, lines);
  }
}

/**
 * Flag `Polarrecorder.ConfigCache = { ... }` literal assignments, which
 * duplicate defaults already owned by the config/API boundary.
 * @param {PatternFile} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @param {string[]} lines File split into lines.
 * @returns {void}
 */
function runConfigCacheLiteralAssignment(file, masked, lines) {
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
      "hardcoded-runtime-default",
      lines
    );
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runPlaceholderLiteral(files) {
  const pattern = /(["'])(?:-{2,3}|N\/A|NO DATA|No Data|No data)\1/g;
  for (const file of files) {
    const { lines } = getFileData(file);
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
        "placeholder-literal",
        lines
      );
    }
  }
}

/**
 * @param {PatternFile[]} files
 * @returns {void}
 */
function runFrameworkMethodTypeofGuard(files) {
  for (const file of files) {
    const { content, lines } = getFileData(file);
    scanJs(
      content,
      file,
      /typeof\s+Polarrecorder(?:\.[A-Za-z_$][\w$]*|\["[A-Za-z_$][\w$]*"])+\s*===\s*"function"/g,
      () => "framework-method-typeof-guard: trust internal Polarrecorder method " + "contracts after module load",
      lines
    );
  }
}

/** @type {Rule[]} */
export const JS_PROJECT_RULES = [
  {
    id: "catch-fallback",
    name: "catch-fallback",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runCatchFallback(files)
  },
  {
    id: "internal-namespace-fallback",
    name: "internal-namespace-fallback",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runInternalNamespaceFallback(files)
  },
  {
    id: "hardcoded-runtime-default",
    name: "hardcoded-runtime-default",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runHardcodedRuntimeDefault(files)
  },
  {
    id: "placeholder-literal",
    name: "placeholder-literal",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runPlaceholderLiteral(files)
  },
  {
    id: "framework-method-typeof-guard",
    name: "framework-method-typeof-guard",
    severity: "block",
    scope: JS_SCOPE,
    run: (_rule, files) => runFrameworkMethodTypeofGuard(files)
  }
];
