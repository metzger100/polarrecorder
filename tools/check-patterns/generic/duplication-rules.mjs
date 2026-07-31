import { getFileData, scopeFor } from "../shared.mjs";

/** @typedef {import("../shared.mjs").Rule} Rule */

const MIN_JS_FUNCTION_TOKENS = 40;
const MIN_PY_FUNCTION_TOKENS = 28;
const WORD = /[A-Za-z_$][\w$]*/g;
const KEYWORDS = new Set([
  "and",
  "as",
  "async",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "def",
  "del",
  "do",
  "elif",
  "else",
  "except",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "if",
  "import",
  "in",
  "is",
  "let",
  "new",
  "none",
  "not",
  "null",
  "or",
  "pass",
  "raise",
  "return",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "while",
  "with",
  "yield"
]);

/** @param {string} text */
function tokens(text) {
  return (
    text
      .replace(WORD, (word, offset, source) => {
        const previous = source[offset - 1];
        if (KEYWORDS.has(word.toLowerCase()) || previous === ".") return word;
        return "ID";
      })
      .match(/[A-Za-z_$][\w$]*|\d+(?:\.\d+)?|[^\s]/g) || []
  );
}

/** @param {string} text @param {number} open */
function closingBrace(text, open) {
  let depth = 0;
  for (let index = open; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    else if (text[index] === "}" && --depth === 0) return index;
  }
  return -1;
}

/** @param {string} file @param {string} text @param {string} masked */
function jsFunctions(file, text, masked) {
  const entries = [];
  const re = /\bfunction\s*[\w$]*\s*\([^)]*\)\s*\{|=>\s*\{/g;
  let match;
  while ((match = re.exec(masked))) {
    const open = match.index + match[0].length - 1;
    const close = closingBrace(masked, open);
    if (close < 0) continue;
    const bodyTokens = tokens(text.slice(open + 1, close));
    if (bodyTokens.length >= MIN_JS_FUNCTION_TOKENS) {
      entries.push({ file, line: text.slice(0, open).split(/\r?\n/).length, fingerprint: bodyTokens.join(" ") });
    }
  }
  return entries;
}

/** @param {string} file @param {string} text */
function pyFunctions(file, text) {
  const lines = text.split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const match = /^(\s*)(?:async\s+)?def\s+\w+\s*\([^)]*\)\s*(?:->[^:]+)?:/.exec(lines[index]);
    if (!match) continue;
    const indent = match[1].length;
    let end = index + 1;
    while (end < lines.length && (lines[end].trim() === "" || (/^\s*/.exec(lines[end])?.[0]?.length || 0) > indent))
      end += 1;
    const bodyTokens = tokens(lines.slice(index + 1, end).join("\n"));
    if (bodyTokens.length >= MIN_PY_FUNCTION_TOKENS)
      entries.push({ file, line: index + 1, fingerprint: bodyTokens.join(" ") });
  }
  return entries;
}

/** @param {string[]} files */
function runDuplicateFunctions(files) {
  /** @type {Map<string, Array<{file: string, line: number, fingerprint: string}>>} */
  const groups = new Map();
  for (const file of files) {
    const { text, masked } = getFileData(file);
    const entries = file.endsWith(".py") ? pyFunctions(file, masked) : jsFunctions(file, text, masked);
    for (const entry of entries) groups.set(entry.fingerprint, [...(groups.get(entry.fingerprint) || []), entry]);
  }
  const findings = [];
  for (const entries of groups.values()) {
    if (new Set(entries.map((entry) => entry.file)).size < 2) continue;
    for (const entry of entries)
      findings.push({
        file: entry.file,
        line: entry.line,
        message: "duplicate-functions: cross-file structural function clone; extract the canonical helper"
      });
  }
  return findings;
}

/** @type {Rule[]} */
export const DUPLICATION_GENERIC_RULES = [
  {
    id: "duplicate-functions",
    name: "duplicate-functions",
    severity: "block",
    scope: scopeFor("duplication-source"),
    run: (_rule, files) => runDuplicateFunctions(files)
  },
  {
    id: "duplicate-block-clones",
    name: "duplicate-block-clones",
    severity: "block",
    scope: scopeFor("duplication-source"),
    run: () => []
  }
];
