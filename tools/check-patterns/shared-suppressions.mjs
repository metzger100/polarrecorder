// Parse suppression-like comments and report every forbidden directive.

import { getFileData, lineAt } from "./shared.mjs";

/** @typedef {{line: number, detail: string}} InvalidSuppression */
/** @typedef {{suppressionsByLine: Map<number, Set<string>>, invalids: InvalidSuppression[]}} LintDirectiveInfo */

/** @type {Map<string, LintDirectiveInfo>} */
let lintDirectiveCache = new Map();
/** @type {string[]} */
let knownRuleNames = [];

/** @returns {void} */
export function resetSuppressionState() {
  lintDirectiveCache = new Map();
  knownRuleNames = [];
}

/** @param {string[]} names @returns {void} */
export function setKnownRuleNames(names) {
  knownRuleNames = Array.isArray(names) ? names.slice() : [];
  lintDirectiveCache = new Map();
}

/** @param {string} file @param {number} line @param {string} ruleName @returns {boolean} */
export function isLintSuppressed(file, line, ruleName) {
  const info = getLintDirectiveInfo(file);
  const suppressedRules = info.suppressionsByLine.get(line);
  return !!(suppressedRules && suppressedRules.has(ruleName));
}

/** @param {string} file @returns {InvalidSuppression[]} */
export function getInvalidLintSuppressions(file) {
  return getLintDirectiveInfo(file).invalids.slice();
}

/** @param {string} file @returns {LintDirectiveInfo} */
function getLintDirectiveInfo(file) {
  const cached = lintDirectiveCache.get(file);
  if (cached) return cached;
  const data = getFileData(file);
  const info = parseLintDirectives(data.text, data.lineStarts);
  lintDirectiveCache.set(file, info);
  return info;
}

/** @param {string} text @param {number[]} lineStarts @returns {LintDirectiveInfo} */
function parseLintDirectives(text, lineStarts) {
  /** @type {Map<number, Set<string>>} */
  const suppressionsByLine = new Map();
  /** @type {InvalidSuppression[]} */
  const invalids = [];
  const knownRules = new Set(knownRuleNames);
  const commentRe = /\/\/[^\n]*|\/\*[\s\S]*?\*\//g;
  let match;

  while ((match = commentRe.exec(text))) {
    const raw = match[0];
    if (!raw.includes("plugin-lint-disable-") && !raw.includes("plugin-boundary-")) continue;

    const line = lineAt(match.index, lineStarts);
    const body = raw.startsWith("//") ? raw.slice(2).trim() : raw.slice(2, -2).trim();

    if (body.includes("plugin-boundary-")) {
      invalids.push({ line, detail: "Boundary suppression markers are forbidden." });
      continue;
    }

    parseLintDisableDirective(body, line, knownRules, suppressionsByLine, invalids);
  }

  return { suppressionsByLine, invalids };
}

/**
 * @param {string} body
 * @param {number} line
 * @param {Set<string>} knownRules
 * @param {Map<number, Set<string>>} suppressionsByLine
 * @param {InvalidSuppression[]} invalids
 * @returns {void}
 */
function parseLintDisableDirective(body, line, knownRules, suppressionsByLine, invalids) {
  const parsed = /^plugin-lint-disable-(next-line|line)\s+([a-z0-9-]+)\s+--\s+(.+)$/s.exec(body);
  if (!parsed) {
    invalids.push({
      line,
      detail:
        `Malformed suppression directive '${body}'. Expected ` +
        "'plugin-lint-disable-next-line <rule-name> -- <reason>' or " +
        "'plugin-lint-disable-line <rule-name> -- <reason>'."
    });
    return;
  }

  const mode = parsed[1];
  const ruleName = parsed[2];
  const reason = parsed[3].trim();
  if (!reason) {
    invalids.push({ line, detail: `Suppression for rule '${ruleName}' is missing a reason.` });
    return;
  }
  if (!knownRules.has(ruleName)) {
    invalids.push({ line, detail: `Suppression references unknown rule '${ruleName}'.` });
    return;
  }
  invalids.push({
    line,
    detail:
      `Generic production suppression '${mode} ${ruleName}' is forbidden. Use a checker-owned ` + "canonical exception."
  });
}
