import fs from "node:fs";
import path from "node:path";

const KEYWORDS = new Set([
  "var",
  "let",
  "const",
  "function",
  "return",
  "if",
  "else",
  "for",
  "while",
  "do",
  "switch",
  "case",
  "default",
  "break",
  "continue",
  "throw",
  "try",
  "catch",
  "finally",
  "new",
  "delete",
  "typeof",
  "instanceof",
  "in",
  "of",
  "void",
  "this",
  "null",
  "true",
  "false",
  "undefined"
]);

/**
 * @typedef {import("./clone-detection.mjs").FunctionEntry} FunctionEntry
 */

/**
 * @param {string} viewerRoot
 * @returns {FunctionEntry[]}
 */
export function collectFunctions(viewerRoot) {
  /** @type {FunctionEntry[]} */
  const out = [];
  if (!fs.existsSync(viewerRoot)) return out;
  for (const name of fs
    .readdirSync(viewerRoot)
    .filter((n) => n.endsWith(".js"))
    .sort()) {
    const rel = `viewer/${name}`;
    const content = fs.readFileSync(path.join(viewerRoot, name), "utf8");
    const masked = maskStringsAndComments(content);
    for (const start of functionBodyStarts(masked)) {
      const end = matchBrace(masked, start);
      if (end < 0) continue;
      const tokens = tokenize(content.slice(start + 1, end));
      out.push({
        id: out.length + 1,
        rel,
        line: content.slice(0, start).split(/\r?\n/).length,
        size: tokens.length,
        fingerprint: tokens.join(" "),
        tokens
      });
    }
  }
  return out;
}

// Offsets of the '{' that opens each function/arrow block body.
/**
 * @param {string} masked
 * @returns {number[]}
 */
function functionBodyStarts(masked) {
  const starts = [];
  const patterns = [/\bfunction\b\s*[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g, /=>\s*\{/g];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(masked)) !== null) {
      starts.push(match.index + match[0].length - 1);
    }
  }
  return starts;
}

/**
 * @param {string} masked
 * @param {number} openIndex
 * @returns {number}
 */
function matchBrace(masked, openIndex) {
  let depth = 0;
  for (let i = openIndex; i < masked.length; i += 1) {
    if (masked[i] === "{") depth += 1;
    else if (masked[i] === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

/**
 * @param {string} body
 * @returns {string[]}
 */
function tokenize(body) {
  const tokens = [];
  let i = 0;
  while (i < body.length) {
    const char = body[i];
    if (/\s/.test(char)) {
      i += 1;
      continue;
    }
    if (char === "/" && body[i + 1] === "/") {
      while (i < body.length && body[i] !== "\n") i += 1;
      continue;
    }
    if (char === "/" && body[i + 1] === "*") {
      i += 2;
      while (i < body.length && !(body[i] === "*" && body[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      i = consumeString(body, i, tokens);
      continue;
    }
    if (/[0-9]/.test(char) || (char === "." && /[0-9]/.test(body[i + 1] || ""))) {
      i = consumeNumber(body, i, tokens);
      continue;
    }
    if (/[A-Za-z_$]/.test(char)) {
      i = consumeWord(body, i, tokens);
      continue;
    }
    tokens.push(char);
    i += 1;
  }
  return tokens;
}

/**
 * @param {string} body
 * @param {number} start
 * @param {string[]} tokens
 * @returns {number}
 */
function consumeString(body, start, tokens) {
  const quote = body[start];
  let i = start + 1;
  while (i < body.length && body[i] !== quote) {
    if (body[i] === "\\") i += 1;
    i += 1;
  }
  tokens.push(`S:${body.slice(start, i + 1)}`);
  return i + 1;
}

/**
 * @param {string} body
 * @param {number} start
 * @param {string[]} tokens
 * @returns {number}
 */
function consumeNumber(body, start, tokens) {
  let i = start;
  while (i < body.length && /[0-9a-fA-FxX._]/.test(body[i])) i += 1;
  tokens.push(`N:${body.slice(start, i)}`);
  return i;
}

/**
 * @param {string} body
 * @param {number} start
 * @param {string[]} tokens
 * @returns {number}
 */
function consumeWord(body, start, tokens) {
  let i = start;
  while (i < body.length && /[A-Za-z0-9_$]/.test(body[i])) i += 1;
  const word = body.slice(start, i);
  const prev = tokens[tokens.length - 1];
  if (prev === ".") tokens.push(`.${word}`);
  else if (KEYWORDS.has(word)) tokens.push(word);
  else tokens.push("ID");
  return i;
}

// Replace string contents and comments with same-length spaces so brace
// matching and the function-start scan ignore braces inside strings/comments.
/**
 * @param {string} content
 * @returns {string}
 */
function maskStringsAndComments(content) {
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
