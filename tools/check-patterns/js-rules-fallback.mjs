import { fail } from "./shared.mjs";
import { findMatchingBrace, findMatchingParen, maskStringsOnly } from "./source-scan.mjs";

// catch-fallback: a lexical try/catch whose body neither rethrows nor carries
// the structured boundary fallback marker silently swallows the error. Empty
// bodies are ESLint's `no-empty` (`allowEmptyCatch: false`); this targets the
// non-empty swallow that rule cannot see. The documented escape hatch is explicit:
// rethrow with 'throw' or add 'polarrecorder-boundary-fallback(<owner>):'.
/**
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
 * @param {string} content Raw file contents.
 * @returns {void}
 */
export function checkCatchFallback(file, content) {
  const masked = maskStringsOnly(content);
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
      "catch-fallback"
    );
  }
}

// internal-namespace-fallback: 'Polarrecorder.X.Helper(...) || fb' / '?? fb'.
// Walks each guarded namespace call with paren matching so nested-argument
// calls are handled and only an operator immediately after the call is flagged.
// The called member must be a PascalCase namespace export (a contract helper
// such as 'Presets.Fallback'); standard array/string methods on namespace-held
// data ('PresetsCache.find(...) || x') are lowercase and stay allowed.
/**
 * @param {import("./shared.mjs").PatternFile} file File being scanned.
 * @param {string} masked Comment-and-string masked file contents.
 * @returns {void}
 */
export function checkInternalNamespaceFallback(file, masked) {
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
      "internal-namespace-fallback"
    );
  }
}
