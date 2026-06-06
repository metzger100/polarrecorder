#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const MAX_ALLOWED_LINES = 400;
const ROOT_MARKDOWN_FILES = [
  "AGENTS.md",
  "ARCHITECTURE.md",
  "CLAUDE.md",
  "CONTRIBUTING.md",
  "README.md",
  "ROADMAP.md"
];
const ROOT_JS_FILES = ["plugin.mjs"];

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
const COLLAPSED_LITERAL_LINE_THRESHOLD = 80;
const COLLAPSED_LITERAL_MIN_COMMAS = 3;
const PACKED_DESTRUCTURING_MIN_BINDINGS = 4;
const PACKED_FOR_HEADER_MIN_COMMAS = 3;
const PACKED_FOR_HEADER_MIN_ASSIGNMENTS = 2;
const DENSE_MIN_STATEMENTS = 2;
// '+' is excluded: string concatenation (idiomatic in the viewer) packs many
// '+' tokens into perfectly readable lines and is not operator density.
const DENSE_OPERATOR_CHARS = "-*/%&|^?:<>!=";

const ONELINER_MESSAGE_BY_KIND = {
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

export function runFileSizeCheck({ root = process.cwd(), onelinerMode = "warn", print = true } = {}) {
  const failures = [];
  const onelinerFindings = [];
  const targetFiles = collectTargetFiles(root);

  for (const file of targetFiles) {
    const content = fs.readFileSync(file.abs, "utf8");
    const nonEmptyLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    if (nonEmptyLines > MAX_ALLOWED_LINES) {
      failures.push(`${file.rel}: ${nonEmptyLines} non-empty lines (limit ${MAX_ALLOWED_LINES})`);
    }
    if (file.rel.endsWith(".js") || file.rel.endsWith(".mjs")) {
      detectOneliners(file, content, onelinerFindings);
    }
  }

  const warnings = [];
  for (const finding of onelinerFindings) {
    const reason = ONELINER_MESSAGE_BY_KIND[finding.kind];
    const line = `[oneliner] ${finding.file}:${finding.line}: ${reason} (${finding.kind}, length ${finding.length})`;
    if (onelinerMode === "block") failures.push(line);
    else warnings.push(line);
  }

  const summary = {
    ok: failures.length === 0,
    checkedFiles: targetFiles.length,
    failures: failures.length,
    onelinerMode,
    onelinerFindings: onelinerFindings.length,
    onelinerByKind: countFindingsByKind(onelinerFindings)
  };

  if (print) reportFileSize(failures, warnings, summary);
  return { ok: summary.ok, failures, onelinerFindings, summary };
}

function reportFileSize(failures, warnings, summary) {
  for (const warning of warnings) console.warn(warning);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[file-size] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("File size check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

function collectTargetFiles(root) {
  const viewerRoot = path.join(root, "viewer");
  const docRoot = path.join(root, "documentation");
  const out = [];
  if (fs.existsSync(viewerRoot)) {
    for (const name of fs.readdirSync(viewerRoot)) {
      if (name.endsWith(".js")) {
        const abs = path.join(viewerRoot, name);
        out.push({ abs, rel: toRel(root, abs) });
      }
    }
  }
  for (const name of ROOT_JS_FILES) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) out.push({ abs, rel: name });
  }
  if (fs.existsSync(docRoot)) walkMarkdown(root, docRoot, out);
  for (const name of ROOT_MARKDOWN_FILES) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) out.push({ abs, rel: name });
  }
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

function walkMarkdown(root, currentPath, out) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    if (currentPath.endsWith(".md")) out.push({ abs: currentPath, rel: toRel(root, currentPath) });
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    walkMarkdown(root, path.join(currentPath, entry.name), out);
  }
}

function toRel(root, absolutePath) {
  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

function detectOneliners(file, content, onelinerFindings) {
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

  if (length > LONG_PACKED_LINE_THRESHOLD && (brackets >= LONG_PACKED_MIN_BRACKETS || commas >= LONG_PACKED_MIN_COMMAS)) {
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

function isSingleLineBody(line) {
  const body = functionBody(line);
  if (body === null || body.length === 0) return false;
  if (/^return\s+[^;{}]{1,60};?$/.test(body)) return false;
  return true;
}

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

function skipSpaces(text, index) {
  let cursor = index;
  while (cursor < text.length && /\s/.test(text[cursor])) cursor += 1;
  return cursor;
}

function functionBody(line) {
  const arrow = line.indexOf("=>");
  const open = arrow >= 0 ? line.indexOf("{", arrow + 2) : openAfterSignature(line);
  if (open < 0) return null;
  const close = findMatching(line, open, "{", "}");
  if (close < 0) return null;
  if (!/\b(function|class)\b|=>/.test(line.slice(0, open))) return null;
  return line.slice(open + 1, close).trim();
}

function openAfterSignature(line) {
  const signatureOpen = line.indexOf("(");
  if (signatureOpen < 0) return -1;
  const signatureClose = findMatching(line, signatureOpen, "(", ")");
  return signatureClose < 0 ? -1 : line.indexOf("{", signatureClose + 1);
}

function isCollapsedBlock(line) {
  return /\b(?:if|for|while|switch|try|else)\b[\s\S]*\{[^{}\n]*;[^{}\n]*\}/.test(line);
}

function isCollapsedLiteral(line) {
  if (line.length <= COLLAPSED_LITERAL_LINE_THRESHOLD) return false;
  if (/^(?:import|export)\b/.test(line) || /\brequire\s*\(/.test(line)) return false;
  for (const pair of [["{", "}"], ["[", "]"]]) {
    if (containsPackedPair(line, pair[0], pair[1])) return true;
  }
  return false;
}

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

function isStackedDeclaration(line) {
  const match = line.match(/^(?:const|let|var)\s+(.+);?$/);
  return !!match && countTopLevelCommas(stripTrailingSemicolon(match[1])) >= 1;
}

function isPackedDestructuring(line) {
  const match = line.match(/^(?:const|let|var)\s+(.+?)=/);
  if (!match) return false;
  const left = match[1].trim();
  if (!(left.startsWith("{") || left.startsWith("["))) return false;
  return countMatches(left, /,/g) + 1 >= PACKED_DESTRUCTURING_MIN_BINDINGS;
}

function isCommaAssignmentSequence(line) {
  if (/^(?:const|let|var)\b/.test(line)) return false;
  return countTopLevelCommas(line) >= 1 && countStandaloneAssignments(line) >= 2;
}

function isPackedForHeader(line) {
  return countMatches(line, /,/g) >= PACKED_FOR_HEADER_MIN_COMMAS
    && countStandaloneAssignments(line) >= PACKED_FOR_HEADER_MIN_ASSIGNMENTS;
}

function hasMultipleStatementLeaders(line) {
  const matches = line.match(
    /(?:^|[;}]\s*)(?:if|for|while|switch|try|function|class|const|let|var|return|throw|do)\b/g
  );
  return (matches || []).length >= 2;
}

function hasCommaCallChain(line) {
  return /(?:^|[;{]\s*)(?:[A-Za-z_$][\w$]*\s*\([^()]*\)\s*,\s*){2,}[A-Za-z_$][\w$]*\s*\([^()]*\)/.test(line);
}

// Semicolons that separate statements: those at paren depth 0 (a for-header's
// two semicolons live inside parentheses and are not counted).
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

function countChars(text, characters) {
  let count = 0;
  for (const char of text) {
    if (characters.includes(char)) count += 1;
  }
  return count;
}

function countTopLevelCommas(text) {
  let depth = 0;
  let count = 0;
  for (const char of text) {
    if ("([{".includes(char)) depth += 1;
    else if (")]}".includes(char)) depth = Math.max(0, depth - 1);
    else if (char === "," && depth === 0) count += 1;
  }
  return count;
}

function countStandaloneAssignments(text) {
  let count = 0;
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] !== "=") continue;
    const prev = text[index - 1] || "";
    const next = text[index + 1] || "";
    if (next === "=" || next === ">" || prev === "=" || prev === "!" || prev === "<" || prev === ">") continue;
    count += 1;
  }
  return count;
}

function countMatches(text, pattern) {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

function stripTrailingSemicolon(text) {
  return String(text || "").replace(/;\s*$/, "").trim();
}

function findMatching(text, openIndex, openChar, closeChar) {
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

function countFindingsByKind(findings) {
  const out = {};
  for (const kind of Object.keys(ONELINER_MESSAGE_BY_KIND)) out[kind] = 0;
  for (const finding of findings) out[finding.kind] = (out[finding.kind] || 0) + 1;
  return out;
}

// Replace string contents and comments with spaces of the same length so
// structural counts ignore characters that live inside strings or comments.
function maskStringsAndComments(content) {
  const chars = [...content];
  let mode = "code";
  let quote = "";
  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i];
    const next = chars[i + 1];
    if (mode === "code") {
      if (char === "/" && next === "/") {
        while (i < chars.length && chars[i] !== "\n") { chars[i] = " "; i += 1; }
        i -= 1;
      } else if (char === "/" && next === "*") {
        chars[i] = " "; chars[i + 1] = " "; i += 2;
        while (i < chars.length && !(chars[i] === "*" && chars[i + 1] === "/")) {
          if (chars[i] !== "\n") chars[i] = " ";
          i += 1;
        }
        if (i < chars.length) { chars[i] = " "; chars[i + 1] = " "; i += 1; }
      } else if (char === '"' || char === "'" || char === "`") {
        mode = "string";
        quote = char;
      }
    } else if (mode === "string") {
      if (char === "\\") {
        chars[i] = " ";
        if (i + 1 < chars.length && chars[i + 1] !== "\n") { chars[i + 1] = " "; i += 1; }
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.includes("--oneliner=block") ? "block" : "warn";
  process.exit(runFileSizeCheck({ onelinerMode: mode }).ok ? 0 : 1);
}
