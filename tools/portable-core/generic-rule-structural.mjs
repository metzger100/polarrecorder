#!/usr/bin/env node

/**
 * @file generic-rule-structural - structural generic rule implementations.
 */

import {
  CANVAS_METHODS,
  GENERIC_FUNCTION_ALLOWLIST,
  TODO_RE,
  countIdentifier,
  dedupe,
  escapeRegex,
  finding,
  lineAt,
  markerOutsideCodeSpan,
  masked,
  matches,
  matchingBrace,
  normalize,
  pushOnce
} from "./generic-rule-common.mjs";

const HOME_PATH = /(?:\/home\/[A-Za-z0-9_.-]+\/|\/Users\/[A-Za-z0-9_.-]+\/)/;
const PLAN_REFERENCE = /\bPLAN\d+\b(?!\.md)|\bPhase\s?\d+[A-Za-z]?\b/;

/** @typedef {{path: string, content: string}} GenericFile */
/** @typedef {{ruleId: string, path: string, line: number, message: string}} GenericFinding */

/** @param {string} ruleId @param {GenericFile} file @param {RegExp} pattern @returns {GenericFinding[]} */
function runRegex(ruleId, file, pattern) {
  return matches(ruleId, file, pattern, () => `canonical generic rule '${ruleId}' rejected the source`);
}

/** @param {string} ruleId @param {GenericFile} file @param {GenericFile[]} _files @param {any} options @returns {GenericFinding[]} */
function runSimple(ruleId, file, _files, options) {
  if (ruleId === "premature-legacy-support") {
    const keywords = /** @type {string[]} */ (
      options.prematureKeywords || ["legacy", "compat", "deprecated", "fallback"]
    );
    return file.content.split(/\r?\n/).flatMap((line, index) => {
      const match = /\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(line);
      const isFunction = /\bfunction\s+/.test(line);
      return match &&
        !(isFunction && countIdentifier(masked(file.content), match[1]) === 1) &&
        keywords.some((keyword) => match[1].toLowerCase().includes(keyword.toLowerCase()))
        ? [finding(ruleId, file, index + 1, `premature compatibility declaration '${match[1]}'`)]
        : [];
    });
  }
  /** @type {Record<string, RegExp>} */
  const patterns = {
    "absolute-home-path": HOME_PATH,
    "exec-plan-reference": PLAN_REFERENCE,
    "console-in-runtime": /\bconsole\.(?:log|info|warn|error|debug)\s*\(/,
    "default-truthy-fallback": /\b[A-Za-z_$][\w$.]*\.default\s*\|\|/,
    "empty-catch": /catch\s*\([^)]*\)\s*\{\s*\}|\.catch\s*\(\s*(?:function\s*\([^)]*\)|\([^)]*\)\s*=>)\s*\{\s*\}\s*\)/
  };
  return runRegex(ruleId, file, patterns[ruleId]);
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runNoNul(ruleId, file) {
  const index = file.content.indexOf(String.fromCharCode(0));
  return index < 0 ? [] : [finding(ruleId, file, lineAt(file.content, index), "literal NUL byte")];
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runTodo(ruleId, file) {
  return file.content
    .split(/\r?\n/)
    .flatMap((line, index) =>
      TODO_RE.test(line) &&
      !(/\.md$/.test(file.path) && /^\s*\|/.test(line)) &&
      !(/\.md$/.test(file.path) && !markerOutsideCodeSpan(line)) &&
      !/(?:TODO|FIXME|HACK|XXX)\s*\(\s*[A-Za-z][\w.-]*\s*,\s*\d{4}-\d{2}-\d{2}\s*\)\s*:/.test(line)
        ? [finding(ruleId, file, index + 1, "work marker requires an owner, date, and description")]
        : []
    );
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runUnusedFallback(ruleId, file) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  /** @type {GenericFinding[]} */
  const out = [];
  const declaration = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\b/g;
  let match;
  while ((match = declaration.exec(source))) {
    if (!/fallback/i.test(match[1])) continue;
    if (countIdentifier(source, match[1]) === 1)
      out.push(finding(ruleId, file, lineAt(file.content, match.index), `unused fallback '${match[1]}'`));
  }
  return out;
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
/** @param {string} ruleId @param {GenericFile} file @param {any} [options] @returns {GenericFinding[]} */
function runDeadCode(ruleId, file, options = {}) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  const out = [];
  const seen = new Set();
  for (const match of file.content.matchAll(/^\s*\/\/\s*(?:const|let|var|function|return|if)\b/gm))
    pushOnce(out, seen, finding(ruleId, file, lineAt(file.content, match.index), "commented-out code is unreachable."));
  if (options.deadCodeCommentsOnly) return out;
  const declaration = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g;
  let match;
  while ((match = declaration.exec(source))) {
    const name = match[1];
    if (/=\s*$/.test(source.slice(Math.max(0, match.index - 4), match.index))) continue;
    if (/\bexport\s+default(?:\s+async)?\s*$/.test(source.slice(Math.max(0, match.index - 40), match.index))) continue;
    if (GENERIC_FUNCTION_ALLOWLIST.has(name) || countIdentifier(source, name) > 1) continue;
    pushOnce(
      out,
      seen,
      finding(ruleId, file, lineAt(file.content, match.index), `Function '${name}' is declared but never referenced.`)
    );
  }
  for (const match of source.matchAll(/\bif\s*\(\s*(true|false)\s*\)/g))
    pushOnce(
      out,
      seen,
      finding(
        ruleId,
        file,
        lineAt(file.content, match.index),
        `Condition 'if (${match[1]})' is constant; one branch is unreachable.`
      )
    );
  for (const match of source.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(true|false)\s*;?/gm)) {
    const re = new RegExp(`\\bif\\s*\\(\\s*!?\\s*${escapeRegex(match[1])}\\s*\\)`, "g");
    for (const branch of source.matchAll(re))
      pushOnce(
        out,
        seen,
        finding(
          ruleId,
          file,
          lineAt(file.content, branch.index),
          `Condition uses constant 'const ${match[1]} = ${match[2]}'.`
        )
      );
  }
  return out;
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runRedundantNull(ruleId, file) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  const out = [];
  const patterns = [
    /\bArray\.isArray\s*\(\s*([A-Za-z_$][\w$.]*)\s*\)\s*\?\s*\1\s*:\s*\[\s*\]/g,
    /\bString\s*\(\s*\(?\s*([A-Za-z_$][\w$.]*)\s*==\s*null\s*\)?\s*\?\s*[^:]+:\s*\1\s*\)/g,
    /(?:\b[A-Za-z_$][\w$.]*\.)?(?:isFiniteNumber|Number\.isFinite|isFinite)\s*\(\s*(?:cfg|p|props|state|theme|display|parsed|opts|style|st|fit)\.[A-Za-z_$][\w$.]*\s*\)\s*\?/g
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern))
      out.push(
        finding(
          ruleId,
          file,
          lineAt(file.content, match.index),
          `redundant internal null/type guard (${match[0].trim()})`
        )
      );
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runResponsive(ruleId, file) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  const out = [];
  for (const match of source.matchAll(/\bMath\.max\s*\(\s*(\d+(?:\.\d+)?)\s*,/g)) {
    if (Number(match[1]) >= 8)
      out.push(
        finding(ruleId, file, lineAt(file.content, match.index), `responsive layout floor (${match[0].trim()})`)
      );
  }
  for (const match of source.matchAll(/\bclamp[A-Za-z_$]*\s*\(\s*[^,]+,\s*(\d+(?:\.\d+)?)\s*,/gi)) {
    if (Number(match[1]) >= 8) {
      const end = source.indexOf(")", match.index);
      out.push(
        finding(
          ruleId,
          file,
          lineAt(file.content, match.index),
          `responsive layout floor (${normalize(file.content.slice(match.index, end + 1))})`
        )
      );
    }
  }
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @param {any} options @returns {GenericFinding[]} */
function runCanvasGuard(ruleId, file, options) {
  const aliases = options.canvasAliases || ["ctx"];
  const re = new RegExp(`\\b(?:${aliases.map(escapeRegex).join("|")})\\.([A-Za-z_$][\\w$]*)\\s*\\(`);
  const guard = /typeof\s+([A-Za-z_$][\w$]*)\.([A-Za-z_$][\w$]*)\s*===\s*["']function["']/g;
  return [...file.content.matchAll(guard)].flatMap((match) =>
    re.test(`${match[1]}.${match[2]}(`) && CANVAS_METHODS.has(match[2])
      ? [
          finding(
            ruleId,
            file,
            lineAt(file.content, match.index),
            `redundant typeof guard for Canvas 2D method ${match[1]}.${match[2]}`
          )
        ]
      : []
  );
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runTryFinally(ruleId, file) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  const out = [];
  for (const match of source.matchAll(/\btry\s*\{/g)) {
    const open = source.indexOf("{", match.index),
      close = matchingBrace(source, open);
    if (open < 0 || close < 0) continue;
    const tail = source.slice(close + 1).match(/^\s*finally\s*\{/);
    if (!tail) continue;
    const finallyOpen = close + 1 + (tail.index ?? 0) + tail[0].lastIndexOf("{");
    const finallyClose = matchingBrace(source, finallyOpen);
    if (finallyClose < 0) continue;
    const restore = /\b([A-Za-z_$][\w$]*)\.restore\s*\(\s*\)\s*;?/.exec(file.content.slice(finallyOpen, finallyClose));
    if (!restore) continue;
    const prelude = source.slice(Math.max(0, match.index - 260), match.index);
    if (
      !new RegExp(`\\b${escapeRegex(restore[1])}\\.save\\s*\\(\\s*\\)`).test(prelude) &&
      !new RegExp(`\\b${escapeRegex(restore[1])}\\.save\\s*\\(\\s*\\)`).test(source.slice(open, close))
    )
      continue;
    out.push(
      finding(
        ruleId,
        file,
        lineAt(file.content, match.index),
        `Canvas save/restore wrapped in try/finally (${restore[1]})`
      )
    );
  }
  return dedupe(out);
}

export {
  runCanvasGuard,
  runDeadCode,
  runNoNul,
  runRedundantNull,
  runResponsive,
  runSimple,
  runTodo,
  runTryFinally,
  runUnusedFallback
};

/** @param {string} ruleId @param {GenericFile} file @param {any} options @returns {GenericFinding[]} */
