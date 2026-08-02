import { getFileData, scopeFor } from "../shared.mjs";
import { findMatchingBrace } from "../ast-utils.mjs";

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

/** @type {Rule[]} */
export const JS_PROJECT_RULES = [
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
  }
];
