import { getFileData, scopeFor } from "../shared.mjs";
import { findMatchingBrace, findMatchingParen } from "../ast-utils.mjs";

/**
 * @typedef {import("../shared.mjs").Rule} Rule
 * @typedef {import("../shared.mjs").Finding} Finding
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

/**
 * @param {string} masked
 * @param {string} file
 * @param {RegExp} regex
 * @param {(match: RegExpExecArray) => string} build
 * @returns {Finding[]}
 */
function scanMasked(masked, file, regex, build) {
  /** @type {Finding[]} */
  const out = [];
  let match;
  while ((match = regex.exec(masked)) !== null) {
    const line = masked.slice(0, match.index).split(/\r?\n/).length;
    out.push({ file, line, message: build(match) });
  }
  return out;
}

// catch-fallback-without-suppression: a lexical try/catch whose body neither rethrows nor carries
// the structured boundary fallback marker silently swallows the error. Empty
// bodies are ESLint's `no-empty`; this targets the non-empty swallow that rule
// cannot see. The documented escape hatch is explicit: rethrow with 'throw' or
// add 'polarrecorder-boundary-fallback(<owner>):'.
/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runCatchFallback(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { maskedStringsOnly: masked } = getFileData(file);
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
      const line = masked.slice(0, match.index).split(/\r?\n/).length;
      out.push({
        file,
        line,
        message:
          "catch-fallback-without-suppression: catch block swallows the error and falls back silently; " +
          "rethrow it, route it to visible state, or mark the boundary fallback with " +
          "polarrecorder-boundary-fallback(<owner>):"
      });
    }
  }
  return out;
}

// internal-contract-fallback: 'Polarrecorder.X.Helper(...) || fb' / '?? fb'.
// Walks each guarded namespace call with paren matching so nested-argument
// calls are handled and only an operator immediately after the call is
// flagged. Standard array/string methods on namespace-held data stay allowed
// because the called member must be a PascalCase namespace export.
/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runInternalNamespaceFallback(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { masked } = getFileData(file);
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
      const line = masked.slice(0, match.index).split(/\r?\n/).length;
      out.push({
        file,
        line,
        message:
          `internal-contract-fallback: '${match[0].trim()}...) ${operator} ...' re-defaults ` +
          "an internal Polarrecorder contract result; trust the namespace and fail " +
          "loudly if the caller order is wrong"
      });
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runHardcodedRuntimeDefault(files) {
  /** @type {Finding[]} */
  const out = [];
  const configFields = CONFIG_DEFAULT_FIELDS.join("|");
  for (const file of files) {
    const { text, masked } = getFileData(file);
    out.push(
      ...scanMasked(
        text,
        file,
        /\bPolarrecorder(?:\.ConfigCache|\["ConfigCache"\])\s*(?:\|\||\?\?)\s*\{\s*\}/g,
        () =>
          "hardcoded-runtime-default: ConfigCache is loaded before dependent UI; " +
          "do not duplicate config defaults downstream"
      )
    );
    out.push(
      ...scanMasked(
        masked,
        file,
        new RegExp(`\\bconfig\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`, "g"),
        (m) => `hardcoded-runtime-default: config.${m[1]} default is owned by the API/config boundary`
      )
    );
    out.push(
      ...scanMasked(
        masked,
        file,
        new RegExp(
          `\\bPolarrecorder(?:\\.ConfigCache|\\["ConfigCache"\\])\\.(${configFields})\\s*(?:\\|\\||\\?\\?)`,
          "g"
        ),
        (m) => `hardcoded-runtime-default: ConfigCache.${m[1]} default is owned by the API/config boundary`
      )
    );
    out.push(...runConfigCacheLiteralAssignment(file, masked));
  }
  return out;
}

/**
 * Flag `Polarrecorder.ConfigCache = { ... }` literal assignments, which
 * duplicate defaults already owned by the config/API boundary.
 * @param {string} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {Finding[]}
 */
function runConfigCacheLiteralAssignment(file, masked) {
  /** @type {Finding[]} */
  const out = [];
  const pattern = /\bPolarrecorder(?:\.ConfigCache|\["ConfigCache"\])\s*=\s*\{/g;
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = pattern.exec(masked)) !== null) {
    const open = masked.indexOf("{", match.index + match[0].length - 1);
    if (open < 0) continue;
    const close = findMatchingBrace(masked, open);
    if (close < 0) continue;
    const line = masked.slice(0, match.index).split(/\r?\n/).length;
    out.push({
      file,
      line,
      message:
        "hardcoded-runtime-default: Polarrecorder.ConfigCache literal duplicates API-owned " +
        "config defaults; surface the boundary failure instead"
    });
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runPlaceholderLiteral(files) {
  /** @type {Finding[]} */
  const out = [];
  const pattern = /(["'])(?:-{2,3}|N\/A|NO DATA|No Data|No data)\1/g;
  for (const file of files) {
    const { text } = getFileData(file);
    const lines = text.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/Polarrecorder\.Placeholders\s*=\s*Object\.freeze\s*\(\s*\{\s*NoData\s*:/.test(line)) continue;
      if (!pattern.test(line)) continue;
      pattern.lastIndex = 0;
      out.push({
        file,
        line: index + 1,
        message:
          "placeholder-literal: placeholder text is owned by Polarrecorder.Placeholders; " +
          "reuse the namespace value instead of duplicating the literal"
      });
    }
  }
  return out;
}

/**
 * @param {string[]} files
 * @returns {Finding[]}
 */
function runFrameworkMethodTypeofGuard(files) {
  /** @type {Finding[]} */
  const out = [];
  for (const file of files) {
    const { text } = getFileData(file);
    out.push(
      ...scanMasked(
        text,
        file,
        /typeof\s+Polarrecorder(?:\.[A-Za-z_$][\w$]*|\["[A-Za-z_$][\w$]*"])+\s*===\s*"function"/g,
        () => "framework-method-typeof-guard: trust internal Polarrecorder method " + "contracts after module load"
      )
    );
  }
  return out;
}

/** @type {Rule[]} */
export const JS_PROJECT_RULES = [
  {
    id: "catch-fallback-without-suppression",
    name: "catch-fallback-without-suppression",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runCatchFallback(files)
  },
  {
    id: "internal-contract-fallback",
    name: "internal-contract-fallback",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runInternalNamespaceFallback(files)
  },
  {
    id: "hardcoded-runtime-default",
    name: "hardcoded-runtime-default",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runHardcodedRuntimeDefault(files)
  },
  {
    id: "placeholder-literal",
    name: "placeholder-literal",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runPlaceholderLiteral(files)
  },
  {
    id: "framework-method-typeof-guard",
    name: "framework-method-typeof-guard",
    severity: "block",
    scope: scopeFor("js-runtime-default"),
    run: (_rule, files) => runFrameworkMethodTypeofGuard(files)
  }
];
