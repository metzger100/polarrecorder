import {
  countChars,
  countMatches,
  countStandaloneAssignments,
  countTopLevelCommas,
  findMatching,
  maskStringsAndComments,
  skipSpaces,
  stripTrailingSemicolon
} from "./scan-helpers.mjs";
import { isCollapsedLiteral, isPackedDestructuring } from "./collapsed-literal-rules.mjs";

// Thresholds mirror tools/check-python-filesize.py so the viewer JS checker is
// no weaker than the Python checker at catching one-liner compression that
// evades the line limit.
const LONG_PACKED_LINE_THRESHOLD = 160;
const OPERATOR_DENSE_LINE_THRESHOLD = 140;
const NESTED_PARENS_LINE_THRESHOLD = 80;
const LONG_PACKED_MIN_BRACKETS = 2;
const LONG_PACKED_MIN_COMMAS = 2;
const OPERATOR_DENSE_MIN_OPERATORS = 8;
const NESTED_PARENS_MIN_COUNT = 14;
const PACKED_FOR_HEADER_MIN_COMMAS = 3;
const PACKED_FOR_HEADER_MIN_ASSIGNMENTS = 2;
const DENSE_MIN_STATEMENTS = 2;
// '+' is excluded: string concatenation (idiomatic in the viewer) packs many
// '+' tokens into perfectly readable lines and is not operator density.
const DENSE_OPERATOR_CHARS = "-*/%&|^?:<>!=";

/**
 * @typedef {"dense-statements"|"single-line-block"|"single-line-body"|"collapsed-literal"|"arrow-body-packed"|"chained-ternary"|"long-packed"|"operator-dense"|"nested-parens"} OnelinerKind
 */

/**
 * @typedef {object} OnelinerFinding
 * @property {string} file - Relative path of the file containing the finding.
 * @property {number} line - 1-based line number of the finding.
 * @property {OnelinerKind} kind - Which one-liner-compression pattern matched.
 * @property {number} length - Trimmed length of the raw (unmasked) source line.
 */

/**
 * @typedef {Record<OnelinerKind, number>} OnelinerCountsByKind
 */

/** @type {Record<OnelinerKind, string>} */
export const ONELINER_MESSAGE_BY_KIND = {
  "dense-statements": "multiple statements packed onto one line",
  "single-line-block": "compound statement body collapsed onto one line",
  "single-line-body": "function body collapsed onto one line",
  "collapsed-literal": "large object/array literal collapsed onto one line",
  "arrow-body-packed": "multi-statement arrow/function body collapsed onto one line",
  "chained-ternary": "chained conditional expression collapsed onto one line",
  "long-packed": "very long packed line",
  "operator-dense": "operator-dense packed line",
  "nested-parens": "nested parenthesized expression packed onto one line"
};

/**
 * @param {{rel: string}} file
 * @param {string} content
 * @param {OnelinerFinding[]} onelinerFindings
 * @returns {void}
 */
export function detectOneliners(file, content, onelinerFindings) {
  const rawLines = content.split(/\r?\n/);
  const maskedLines = maskStringsAndComments(content).split(/\r?\n/);
  for (let index = 0; index < rawLines.length; index += 1) {
    const masked = maskedLines[index].trim();
    if (!masked) continue;
    const kind = onelinerKind(masked);
    if (kind !== null) {
      const length = rawLines[index].trim().length;
      onelinerFindings.push({ file: file.rel, line: index + 1, kind, length });
    }
  }
}

// First matching kind wins so a single dense line is reported once.
/**
 * @param {string} masked
 * @returns {OnelinerKind | null}
 */
function onelinerKind(masked) {
  if (countTernaryOperators(masked) >= 2) return "chained-ternary";
  if (isCollapsedLiteral(masked)) return "collapsed-literal";
  if (isCollapsedBlock(masked)) return "single-line-block";
  if (isSingleLineBody(masked)) return "single-line-body";
  if (isBraceFreeGuardClause(masked)) return null;

  const length = masked.length;
  const brackets = countChars(masked, "()[]{}");
  const commas = masked.split(",").length - 1;
  const operators = countChars(masked, DENSE_OPERATOR_CHARS);
  const parens = countChars(masked, "()");

  if (
    length > LONG_PACKED_LINE_THRESHOLD &&
    (brackets >= LONG_PACKED_MIN_BRACKETS || commas >= LONG_PACKED_MIN_COMMAS)
  ) {
    return "long-packed";
  }
  if (length > OPERATOR_DENSE_LINE_THRESHOLD && operators >= OPERATOR_DENSE_MIN_OPERATORS) {
    return "operator-dense";
  }
  if (length > NESTED_PARENS_LINE_THRESHOLD && parens >= NESTED_PARENS_MIN_COUNT) {
    return "nested-parens";
  }
  if (isDenseOneliner(masked)) return "dense-statements";
  return null;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isDenseOneliner(line) {
  if (countStatementSemicolons(line) >= DENSE_MIN_STATEMENTS) return true;
  if (/^for\s*\(/.test(line) && isPackedForHeader(line)) return true;
  if (isStackedDeclaration(line)) return true;
  if (isPackedDestructuring(line)) return true;
  if (isCommaAssignmentSequence(line)) return true;
  if (hasMultipleStatementLeaders(line)) return true;
  if (hasCommaCallChain(line)) return true;
  return /(?:\)|\})\s*(?:if|for|while|switch|try|function|class|const|let|var|return|throw|do)\b/.test(line);
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isSingleLineBody(line) {
  const body = functionBody(line);
  if (body === null || body.length === 0) return false;
  if (/^return\s+[^;{}]{1,60};?$/.test(body)) return false;
  return true;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isBraceFreeGuardClause(line) {
  const start = skipSpaces(line, 0);
  if (!line.startsWith("if", start)) return false;
  const afterIf = skipSpaces(line, start + 2);
  if (line[afterIf] !== "(") return false;
  const conditionEnd = findMatching(line, afterIf, "(", ")");
  if (conditionEnd < 0) return false;
  const statementStart = skipSpaces(line, conditionEnd + 1);
  const keyword = line.startsWith("return", statementStart) ? "return" : "throw";
  if (!line.startsWith(keyword, statementStart)) return false;
  const semicolon = line.indexOf(";", statementStart + keyword.length);
  return semicolon >= 0 && line.slice(semicolon + 1).trim() === "";
}

/**
 * @param {string} line
 * @returns {string | null}
 */
function functionBody(line) {
  const arrow = line.indexOf("=>");
  const open = arrow >= 0 ? line.indexOf("{", arrow + 2) : openAfterSignature(line);
  if (open < 0) return null;
  const close = findMatching(line, open, "{", "}");
  if (close < 0) return null;
  if (!/\b(function|class)\b|=>/.test(line.slice(0, open))) return null;
  return line.slice(open + 1, close).trim();
}

/**
 * @param {string} line
 * @returns {number}
 */
function openAfterSignature(line) {
  const signatureOpen = line.indexOf("(");
  if (signatureOpen < 0) return -1;
  const signatureClose = findMatching(line, signatureOpen, "(", ")");
  return signatureClose < 0 ? -1 : line.indexOf("{", signatureClose + 1);
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isCollapsedBlock(line) {
  return /\b(?:if|for|while|switch|try|else)\b[\s\S]*\{[^{}\n]*;[^{}\n]*\}/.test(line);
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isStackedDeclaration(line) {
  const match = line.match(/^(?:const|let|var)\s+(.+);?$/);
  return !!match && countTopLevelCommas(stripTrailingSemicolon(match[1])) >= 1;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isCommaAssignmentSequence(line) {
  if (/^(?:const|let|var)\b/.test(line)) return false;
  return countTopLevelCommas(line) >= 1 && countStandaloneAssignments(line) >= 2;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function isPackedForHeader(line) {
  return (
    countMatches(line, /,/g) >= PACKED_FOR_HEADER_MIN_COMMAS &&
    countStandaloneAssignments(line) >= PACKED_FOR_HEADER_MIN_ASSIGNMENTS
  );
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasMultipleStatementLeaders(line) {
  const matches = line.match(
    /(?:^|[;}]\s*)(?:if|for|while|switch|try|function|class|const|let|var|return|throw|do)\b/g
  );
  return (matches || []).length >= 2;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
function hasCommaCallChain(line) {
  return /(?:^|[;{]\s*)(?:[A-Za-z_$][\w$]*\s*\([^()]*\)\s*,\s*){2,}[A-Za-z_$][\w$]*\s*\([^()]*\)/.test(line);
}

// Semicolons that separate statements: those at paren depth 0 (a for-header's
// two semicolons live inside parentheses and are not counted).
/**
 * @param {string} line
 * @returns {number}
 */
function countStatementSemicolons(line) {
  let depth = 0;
  let count = 0;
  for (const char of line) {
    if (char === "(" || char === "[") depth += 1;
    else if (char === ")" || char === "]") depth = Math.max(0, depth - 1);
    else if (char === ";" && depth === 0) count += 1;
  }
  return count;
}

// Ternary '?' only: optional chaining (?.) and nullish (??) are removed first.
/**
 * @param {string} line
 * @returns {number}
 */
function countTernaryOperators(line) {
  let depth = 0;
  let count = 0;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1] || "";
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (char === "?" && next !== "." && next !== "?") count += 1;
  }
  return count;
}

/**
 * @param {OnelinerFinding[]} findings
 * @returns {OnelinerCountsByKind}
 */
export function countFindingsByKind(findings) {
  // Object.keys widens to string[], but every key of ONELINER_MESSAGE_BY_KIND
  // is by construction a valid OnelinerKind.
  const kinds = /** @type {OnelinerKind[]} */ (Object.keys(ONELINER_MESSAGE_BY_KIND));
  const out = /** @type {OnelinerCountsByKind} */ ({});
  for (const kind of kinds) out[kind] = 0;
  for (const finding of findings) out[finding.kind] = (out[finding.kind] || 0) + 1;
  return out;
}
