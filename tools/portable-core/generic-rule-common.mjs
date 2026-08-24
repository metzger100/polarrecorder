#!/usr/bin/env node

/**
 * @file generic-rule-common - shared parsing and finding primitives for the portable generic rules.
 */

const CANVAS_METHODS = new Set(
  "arc beginPath clearRect closePath fill fillRect fillText lineTo measureText moveTo restore rotate save scale setLineDash stroke strokeRect translate createLinearGradient createRadialGradient drawImage getImageData putImageData".split(
    " "
  )
);
const GENERIC_FUNCTION_ALLOWLIST = new Set(["create", "translateFunction", "translate", "renderCanvas"]);
const TODO_RE = /\b(?:TODO|FIXME|HACK|XXX)\b/;

/** @typedef {{path: string, content: string}} GenericFile */
/** @typedef {{ruleId: string, path: string, line: number, message: string}} GenericFinding */

/** @param {string} ruleId @param {GenericFile} file @param {number} line @param {string} message @returns {GenericFinding} */
function finding(ruleId, file, line, message) {
  return { ruleId, path: file.path, line, message: `[${ruleId}] ${message}` };
}
/** @param {GenericFinding | null} item @returns {item is GenericFinding} */
function isFinding(item) {
  return item !== null;
}
/** @param {string} ruleId @param {GenericFile} file @param {RegExp} pattern @param {(line:string)=>string} message @returns {GenericFinding[]} */
function matches(ruleId, file, pattern, message) {
  return file.content
    .split(/\r?\n/)
    .flatMap((line, index) => (pattern.test(line) ? [finding(ruleId, file, index + 1, message(line))] : []));
}
/** @param {string} text @returns {string} */
function masked(text) {
  return text.replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`/g, (value) =>
    value.replace(/[^\n]/g, " ")
  );
}
/** @param {string} text @param {number} open @returns {number} */
function matchingBrace(text, open) {
  let depth = 0;
  for (let i = open; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && --depth === 0) return i;
  }
  return -1;
}
/** @param {string} text @param {number} index @returns {number} */
function lineAt(text, index) {
  return text.slice(0, index).split(/\r?\n/).length;
}
/** @param {string} text @param {string} name @returns {number} */
function countIdentifier(text, name) {
  return (text.match(new RegExp(`(?<![A-Za-z0-9_$])${escapeRegex(name)}(?![A-Za-z0-9_$])`, "g")) || []).length;
}
/** @param {string} value @returns {string} */
function escapeRegex(value) {
  return String(value).replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
/** @param {string} text @returns {string} */
function normalize(text) {
  return String(text).replace(/\s+/g, " ").trim();
}
/** @param {string} text @returns {string[]} */
function tokenize(text) {
  return [
    ...text.matchAll(/(?:[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|===|!==|=>|&&|\|\||\?\?|[{}()[\];:,.+*\x2f%<>=!?&|^~-])/g)
  ].map((match) => match[0]);
}
/** @param {string[]} tokens @returns {number} */
function countControls(tokens) {
  return tokens.filter((token) => ["if", "for", "while", "switch", "catch"].includes(token)).length;
}
/** @param {string[]} tokens @returns {number} */
function countStatements(tokens) {
  return tokens.filter((token) => token === ";").length;
}
/** @param {GenericFinding[]} findings @returns {GenericFinding[]} */
function dedupe(findings) {
  const seen = new Set();
  return findings.filter((item) => {
    const key = `${item.path}:${item.line}:${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
/** @param {GenericFinding[]} out @param {Set<string>} seen @param {GenericFinding} item @returns {void} */
function pushOnce(out, seen, item) {
  const key = `${item.path}:${item.line}`;
  if (!seen.has(key)) {
    seen.add(key);
    out.push(item);
  }
}
/** @param {GenericFinding} a @param {GenericFinding} b @returns {number} */
function compareFindings(a, b) {
  return (
    a.ruleId.localeCompare(b.ruleId) ||
    a.path.localeCompare(b.path) ||
    a.line - b.line ||
    a.message.localeCompare(b.message)
  );
}
/** @param {string} line @returns {boolean} */
function markerOutsideCodeSpan(line) {
  return line
    .split("`")
    .filter((_part, index) => index % 2 === 0)
    .some((part) => TODO_RE.test(part));
}

export {
  CANVAS_METHODS,
  GENERIC_FUNCTION_ALLOWLIST,
  TODO_RE,
  compareFindings,
  countControls,
  countIdentifier,
  countStatements,
  dedupe,
  escapeRegex,
  finding,
  isFinding,
  lineAt,
  markerOutsideCodeSpan,
  masked,
  matches,
  matchingBrace,
  normalize,
  pushOnce,
  tokenize
};
