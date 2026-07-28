// A fingerprint must span at least this many tokens to count as a clone. Small
// accessors and one-line wrappers stay below it and are never flagged.
export const MIN_FINGERPRINT_TOKENS = 40;
const DUPLICATE_BLOCK_WINDOW = 35;
const DUPLICATE_BLOCK_MIN_TOKENS = 120;

/**
 * @typedef {object} FunctionEntry
 * @property {number} id - Sequential id assigned during collection; used to
 *   establish a stable left/right ordering when comparing candidate pairs.
 * @property {string} rel - File path relative to the repo root (e.g. "viewer/foo.js").
 * @property {number} line - 1-based source line where the function body opens.
 * @property {number} size - Token count of the function body.
 * @property {string} fingerprint - Space-joined structural token sequence.
 * @property {string[]} tokens - Structural tokens making up the fingerprint.
 */

/**
 * @typedef {object} WindowMatch
 * @property {FunctionEntry} entry
 * @property {number} start
 * @property {number} end
 */

/**
 * @typedef {object} PairSegment
 * @property {number} leftStart
 * @property {number} leftEnd
 * @property {number} rightStart
 * @property {number} rightEnd
 */

/**
 * @typedef {object} PairGroup
 * @property {FunctionEntry} left
 * @property {FunctionEntry} right
 * @property {PairSegment[]} segments
 */

/**
 * @param {FunctionEntry[]} entries
 * @returns {string[]}
 */
export function duplicateBlockFailures(entries) {
  /** @type {Map<string, WindowMatch[]>} */
  const windows = new Map();
  for (const entry of entries) {
    if (entry.tokens.length < DUPLICATE_BLOCK_WINDOW) continue;
    for (let index = 0; index <= entry.tokens.length - DUPLICATE_BLOCK_WINDOW; index += 1) {
      const key = entry.tokens.slice(index, index + DUPLICATE_BLOCK_WINDOW).join(" ");
      let bucket = windows.get(key);
      if (!bucket) {
        bucket = [];
        windows.set(key, bucket);
      }
      bucket.push({ entry, start: index, end: index + DUPLICATE_BLOCK_WINDOW });
    }
  }

  /** @type {Map<string, PairGroup>} */
  const pairs = new Map();
  for (const matches of windows.values()) {
    if (matches.length < 2) continue;
    for (let leftIndex = 0; leftIndex < matches.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < matches.length; rightIndex += 1) {
        addPairSegment(pairs, matches[leftIndex], matches[rightIndex]);
      }
    }
  }

  /** @type {string[]} */
  const out = [];
  /** @type {Set<string>} */
  const seen = new Set();
  for (const group of pairs.values()) {
    for (const segment of mergeSegments(group.segments)) {
      const tokenCount = segment.leftEnd - segment.leftStart;
      if (tokenCount < DUPLICATE_BLOCK_MIN_TOKENS) continue;
      const key = `${group.left.rel}:${group.left.line}:${group.right.rel}:${group.right.line}:${tokenCount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `duplicate function block across files: ${group.left.rel}:${group.left.line}, ` +
          `${group.right.rel}:${group.right.line} (${tokenCount} tokens); ` +
          "extract one canonical helper under window.Polarrecorder and reuse it"
      );
    }
  }
  return out.sort();
}

/**
 * @param {Map<string, PairGroup>} pairs
 * @param {WindowMatch} leftMatch
 * @param {WindowMatch} rightMatch
 * @returns {void}
 */
function addPairSegment(pairs, leftMatch, rightMatch) {
  if (leftMatch.entry.rel === rightMatch.entry.rel) return;
  let left = leftMatch;
  let right = rightMatch;
  if (left.entry.id > right.entry.id) {
    left = rightMatch;
    right = leftMatch;
  }
  const delta = left.start - right.start;
  const key = `${left.entry.id}:${right.entry.id}:${delta}`;
  let group = pairs.get(key);
  if (!group) {
    group = { left: left.entry, right: right.entry, segments: [] };
    pairs.set(key, group);
  }
  group.segments.push({
    leftStart: left.start,
    leftEnd: left.end,
    rightStart: right.start,
    rightEnd: right.end
  });
}

/**
 * @param {PairSegment[]} segments
 * @returns {PairSegment[]}
 */
function mergeSegments(segments) {
  const sorted = segments.slice().sort((a, b) => a.leftStart - b.leftStart || a.rightStart - b.rightStart);
  const merged = [];
  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    if (last && segment.leftStart <= last.leftEnd && segment.rightStart <= last.rightEnd) {
      last.leftEnd = Math.max(last.leftEnd, segment.leftEnd);
      last.rightEnd = Math.max(last.rightEnd, segment.rightEnd);
    } else {
      merged.push({ ...segment });
    }
  }
  return merged;
}
