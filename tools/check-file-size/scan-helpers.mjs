/**
 * @param {string} text
 * @param {number} index
 * @returns {number}
 */
export function skipSpaces(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

/**
 * @param {string} text
 * @param {number} openIndex
 * @param {string} openChar
 * @param {string} closeChar
 * @returns {number}
 */
export function findMatching(text, openIndex, openChar, closeChar) {
  let depth = 0;
  for (let index = openIndex; index < text.length; index += 1) {
    if (text[index] === openChar) depth += 1;
    else if (text[index] === closeChar) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

/**
 * @param {string} text
 * @param {string} characters
 * @returns {number}
 */
export function countChars(text, characters) {
  let count = 0;
  for (const char of text) {
    if (characters.includes(char)) count += 1;
  }
  return count;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function countTopLevelCommas(text) {
  let depth = 0;
  let count = 0;
  for (const char of text) {
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) count += 1;
  }
  return count;
}

/**
 * @param {string} text
 * @returns {number}
 */
export function countStandaloneAssignments(text) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "=") continue;
    const prev = text[index - 1] || "";
    const next = text[index + 1] || "";
    if (
      next === "=" ||
      next === ">" ||
      prev === "=" ||
      prev === "!" ||
      prev === "<" ||
      prev === ">"
    )
      continue;
    count += 1;
  }
  return count;
}

/**
 * @param {string} text
 * @param {RegExp} pattern
 * @returns {number}
 */
export function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * @param {string} text
 * @returns {string}
 */
export function stripTrailingSemicolon(text) {
  return String(text || "")
    .replace(/;\s*$/, "")
    .trim();
}

// Replace string contents and comments with spaces of the same length so
// structural counts ignore characters that live inside strings or comments.
/**
 * @param {string} content
 * @returns {string}
 */
export function maskStringsAndComments(content) {
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
        chars[i] = " ";
        chars[i + 1] = " ";
        i += 2;
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
    } else if (mode === "string") {
      if (char === "\\") {
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
  }
  return chars.join("");
}
