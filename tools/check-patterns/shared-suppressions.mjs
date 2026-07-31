// Lint-directive / suppression-comment parsing (plugin-lint-disable-*, plugin-boundary-*).
// De-branded generic suppression grammar: no product token, no repository name. Replaces the
// former weaker `pattern-ignore: <ruleName>` convention (no owner, no reason, no expiry).

import { getFileData, lineAt } from "./shared.mjs";

/** @typedef {{line: number, detail: string}} InvalidSuppression */
/** @typedef {{suppressionsByLine: Map<number, Set<string>>, invalids: InvalidSuppression[]}} LintDirectiveInfo */

/** @type {Map<string, LintDirectiveInfo>} */
let lintDirectiveCache = new Map();
/** @type {string[]} */
let knownRuleNames = [];

/**
 * The one rule name a `plugin-boundary-next-line(...)` marker may suppress: the catch/fallback
 * concept. Update this constant if that rule's canonical name changes.
 */
export const BOUNDARY_MARKER_RULE_NAME = "catch-fallback-without-suppression";

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
      parseBoundaryMarker(body, line, suppressionsByLine, invalids);
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
      `Generic production suppression '${mode} ${ruleName}' is forbidden. Use a checker-owned ` +
      "canonical exception, or a validated plugin-boundary marker for an external catch fallback."
  });
}

/**
 * @param {string} body
 * @param {number} line
 * @param {Map<number, Set<string>>} suppressionsByLine
 * @param {InvalidSuppression[]} invalids
 * @returns {void}
 */
function parseBoundaryMarker(body, line, suppressionsByLine, invalids) {
  const parsed = /^plugin-boundary-(next-line|line)\(([^)]*)\)\s+--\s+(.+)$/s.exec(body);
  if (!parsed) {
    invalids.push({
      line,
      detail:
        `Malformed boundary marker '${body}'. Expected ` +
        "'plugin-boundary-next-line(category: <slug>, owner: <handle>, date: <YYYY-MM-DD>[, expires: <YYYY-MM-DD>]) -- <reason>' " +
        "or the '-line' variant."
    });
    return;
  }

  const mode = parsed[1];
  const reason = parsed[3].trim();
  const fields = parseBoundaryMarkerFields(parsed[2]);
  const error = validateBoundaryMarkerFields(fields, reason);
  if (error) {
    invalids.push({ line, detail: `Invalid boundary marker: ${error}` });
    return;
  }

  addSuppression(suppressionsByLine, mode === "next-line" ? line + 1 : line, BOUNDARY_MARKER_RULE_NAME);
}

/** @param {string} rawFields @returns {Record<string, string>} */
function parseBoundaryMarkerFields(rawFields) {
  /** @type {Record<string, string>} */
  const fields = {};
  for (const entry of rawFields.split(",")) {
    const separatorIndex = entry.indexOf(":");
    if (separatorIndex < 0) continue;
    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (key) fields[key] = value;
  }
  return fields;
}

/** @param {Record<string, string>} fields @param {string} reason @returns {string|null} */
function validateBoundaryMarkerFields(fields, reason) {
  if (!fields.category || !/^[a-z][a-z0-9-]*$/.test(fields.category)) {
    return "'category' is required and must be a lowercase kebab-case slug.";
  }
  if (!fields.owner || !/^[A-Za-z0-9][A-Za-z0-9-]*$/.test(fields.owner)) {
    return "'owner' is required and must be a handle-like identifier.";
  }
  if (!fields.date || !isValidIsoDate(fields.date)) {
    return "'date' is required and must be a valid 'YYYY-MM-DD' calendar date.";
  }
  if (fields.expires !== undefined) {
    if (!isValidIsoDate(fields.expires)) {
      return "'expires' must be a valid 'YYYY-MM-DD' calendar date.";
    }
    if (fields.expires < isoToday()) {
      return `temporary marker expired on ${fields.expires}.`;
    }
  }
  if (!reason) {
    return "a reason after '--' is required.";
  }
  return null;
}

/** @param {string} value @returns {boolean} */
function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** @returns {string} */
function isoToday() {
  return new Date().toISOString().slice(0, 10);
}

/** @param {Map<number, Set<string>>} suppressionsByLine @param {number} targetLine @param {string} ruleName @returns {void} */
function addSuppression(suppressionsByLine, targetLine, ruleName) {
  let ruleSet = suppressionsByLine.get(targetLine);
  if (!ruleSet) {
    ruleSet = new Set();
    suppressionsByLine.set(targetLine, ruleSet);
  }
  ruleSet.add(ruleName);
}
