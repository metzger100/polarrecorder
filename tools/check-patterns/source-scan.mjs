import { fail } from "./shared.mjs";

/**
 * @param {string} line Single source line.
 * @returns {string} The line with string literal bodies replaced by `""`.
 */
export function stripStrings(line) {
  return line.replace(/(["'`])(?:\\.|(?!\1).)*\1/g, '""');
}

// Replace string contents with spaces while leaving comments and newlines
// intact. Comments are recognised (so quotes inside them do not open a string)
// but not blanked, so a comment inside a catch block still defeats the
// empty-catch match.
/**
 * @param {string} content Raw file contents.
 * @returns {string} Contents with string literal bodies blanked to spaces.
 */
export function maskStringsOnly(content) {
  const chars = [...content];
  let mode = "code";
  let quote = "";
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        while (i < chars.length && chars[i] !== "\n") i += 1;
        i -= 1;
      } else if (char === "/" && next === "*") {
        i += 2;
        while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) i += 1;
        i += 1;
      } else if (char === '"' || char === "'" || char === "`") {
        mode = "string";
        quote = char;
      }
    } else if (char === "\\") {
      chars[i] = " ";
      if (i + 1 < chars.length && chars[i + 1] !== "\n") {
        chars[i + 1] = " ";
        i += 1;
      }
    } else if (char === quote) {
      mode = "code";
      quote = "";
    } else if (char !== "\n") {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

// Replace BOTH string contents and comment bodies with spaces (newlines kept)
// so that structural rules count only real code. Unlike maskStringsOnly, this
// blanks comments too, so commented-out code never registers as a reference.
/**
 * @param {string} content Raw file contents.
 * @returns {string} Contents with string literal and comment bodies blanked to spaces.
 */
export function maskCode(content) {
  const chars = [...content];
  let mode = "code";
  let quote = "";
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        while (i < chars.length && chars[i] !== "\n") {
          chars[i] = " ";
          i += 1;
        }
        i -= 1;
      } else if (char === "/" && next === "*") {
        while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) {
          if (chars[i] !== "\n") chars[i] = " ";
          i += 1;
        }
        if (i < chars.length) {
          chars[i] = " ";
          chars[i + 1] = " ";
          i += 1;
        }
      } else if (char === '"' || char === "'" || char === "`") {
        mode = "string";
        quote = char;
      }
    } else if (char === "\\") {
      chars[i] = " ";
      if (i + 1 < chars.length && chars[i + 1] !== "\n") {
        chars[i + 1] = " ";
        i += 1;
      }
    } else if (char === quote) {
      mode = "code";
      quote = "";
    } else if (char !== "\n") {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

/**
 * @param {string} content Raw Markdown file contents.
 * @returns {string} Contents with fenced code blocks and inline code spans blanked.
 */
export function stripMarkdownCode(content) {
  const lines = content.split(/\r?\n/);
  /** @type {string[]} */
  const out = [];
  let inFence = false;
  for (const line of lines) {
    if (/^\s*(```+|~~~+)/.test(line)) {
      inFence = !inFence;
      out.push("");
      continue;
    }
    out.push(inFence ? "" : line.replace(/`[^`\n]*`/g, ""));
  }
  return out.join("\n");
}

/**
 * Return the index of the '}' that closes the '{' at openIndex, or -1.
 * @param {string} text Text to scan.
 * @param {number} openIndex Index of the opening '{'.
 * @returns {number} Index of the matching '}', or -1 if unmatched.
 */
export function findMatchingBrace(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "{") depth += 1;
    else if (text[i] === "}" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/**
 * Return the index of the ')' that closes the '(' at openIndex, or -1.
 * @param {string} text Text to scan.
 * @param {number} openIndex Index of the opening '('.
 * @returns {number} Index of the matching ')', or -1 if unmatched.
 */
export function findMatchingParen(text, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    if (text[i] === "(") depth += 1;
    else if (text[i] === ")" && (depth -= 1) === 0) return i;
  }
  return -1;
}

/**
 * Extract the leading `rule-name:` token from a failure message built by a
 * scanJs() callback, so scanJs() itself does not need each rule name passed
 * separately.
 * @param {string} message Failure message produced by a scanJs() callback.
 * @returns {string} The rule id prefix, or "pattern" if none was found.
 */
export function ruleNameFromMessage(message) {
  const match = /^([a-z0-9-]+):/.exec(message);
  return match ? match[1] : "pattern";
}

/**
 * Count word-boundary references to an identifier in masked text. A lone
 * declaration yields 1; any real use pushes the count above 1.
 * @param {string} masked Comment-and-string masked file contents.
 * @param {string} name Identifier to count references of.
 * @returns {number} Number of word-boundary occurrences of `name`.
 */
export function countRefs(masked, name) {
  const matches = masked.match(new RegExp(`\\b${name}\\b`, "g"));
  return matches ? matches.length : 0;
}

/**
 * Run a regex over masked text; for each match, build() returns a message or
 * null to skip. Reports at the match's line using the shared fail() format.
 * @param {string} masked Comment-and-string masked (or raw) file contents to scan.
 * @param {import("./shared.mjs").PatternFile} file File being scanned, for failure reporting.
 * @param {RegExp} regex Global regex to iterate matches of.
 * @param {(match: RegExpExecArray) => (string | null)} build Builds a failure
 *   message for a match, or returns null to skip it.
 * @param {string[]} [lines] File split into lines, to honor the generic
 *   `pattern-ignore:` suppression convention. Omit to skip the check.
 * @returns {void}
 */
export function scanJs(masked, file, regex, build, lines) {
  /** @type {RegExpExecArray | null} */
  let match;
  while ((match = regex.exec(masked)) !== null) {
    const message = build(match);
    if (message === null) continue;
    const index = masked.slice(0, match.index).split(/\r?\n/).length - 1;
    fail(file.rel, index, message, ruleNameFromMessage(message), lines);
  }
}
