import { countMatches, countTopLevelCommas, findMatching } from "./scan-helpers.mjs";

const COLLAPSED_LITERAL_LINE_THRESHOLD = 80;
const COLLAPSED_LITERAL_MIN_COMMAS = 3;
const PACKED_DESTRUCTURING_MIN_BINDINGS = 4;

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isCollapsedLiteral(line) {
  if (line.length <= COLLAPSED_LITERAL_LINE_THRESHOLD) return false;
  if (/^(?:import|export)\b/.test(line) || /\brequire\s*\(/.test(line)) return false;
  for (const pair of [
    ["{", "}"],
    ["[", "]"]
  ]) {
    if (containsPackedPair(line, pair[0], pair[1])) return true;
  }
  return false;
}

/**
 * @param {string} line
 * @param {string} openChar
 * @param {string} closeChar
 * @returns {boolean}
 */
function containsPackedPair(line, openChar, closeChar) {
  for (let index = 0; index < line.length; index += 1) {
    if (line[index] !== openChar) continue;
    const close = findMatching(line, index, openChar, closeChar);
    if (close < 0) continue;
    const inside = line.slice(index + 1, close);
    if (countTopLevelCommas(inside) >= COLLAPSED_LITERAL_MIN_COMMAS) return true;
  }
  return false;
}

/**
 * @param {string} line
 * @returns {boolean}
 */
export function isPackedDestructuring(line) {
  const match = line.match(/^(?:const|let|var)\s+(.+?)=/);
  if (!match) return false;
  const left = match[1].trim();
  if (!(left.startsWith("{") || left.startsWith("["))) return false;
  return countMatches(left, /,/g) + 1 >= PACKED_DESTRUCTURING_MIN_BINDINGS;
}
