#!/usr/bin/env node

/**
 * Cross-file duplicate-function detector for viewer/*.js.
 *
 * AI agents reliably re-implement a viewer helper instead of reusing the
 * canonical one under window.Polarrecorder (CLAUDE.md Section 8). This is the
 * JS counterpart to tools/check-duplication.py, which only covers Python.
 *
 * Each function body is reduced to a structural fingerprint: bare local
 * identifiers are normalised to "ID" (so variable-renamed copies still match)
 * while member names (.foo), called keywords, operators, punctuation and
 * literal values are preserved (so unrelated same-shape functions do not
 * collide). Two functions in different files sharing a fingerprint above the
 * token threshold are flagged; the fix is to extract one canonical helper.
 *
 * Exit 0 when clean, 1 when duplicates are found.
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// A fingerprint must span at least this many tokens to count as a clone. Small
// accessors and one-line wrappers stay below it and are never flagged.
const MIN_FINGERPRINT_TOKENS = 40;
const DUPLICATE_BLOCK_WINDOW = 35;
const DUPLICATE_BLOCK_MIN_TOKENS = 120;

const KEYWORDS = new Set([
  "var", "let", "const", "function", "return", "if", "else", "for", "while",
  "do", "switch", "case", "default", "break", "continue", "throw", "try",
  "catch", "finally", "new", "delete", "typeof", "instanceof", "in", "of",
  "void", "this", "null", "true", "false", "undefined"
]);

export function runJsDuplicationCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const functions = collectFunctions(viewerRoot);
  const byFingerprint = new Map();
  for (const fn of functions) {
    if (fn.size < MIN_FINGERPRINT_TOKENS) continue;
    if (!byFingerprint.has(fn.fingerprint)) byFingerprint.set(fn.fingerprint, []);
    byFingerprint.get(fn.fingerprint).push(fn);
  }

  const failures = [];
  for (const group of byFingerprint.values()) {
    const files = new Set(group.map((fn) => fn.rel));
    if (files.size < 2) continue;
    const locations = group.map((fn) => `${fn.rel}:${fn.line}`).join(", ");
    failures.push(
      `duplicate function body across files: ${locations}; `
      + "extract one canonical helper under window.Polarrecorder and reuse it"
    );
  }
  failures.push(...duplicateBlockFailures(functions));
  failures.sort();

  const summary = { ok: failures.length === 0, checkedFunctions: functions.length, failures: failures.length };
  if (print) reportDuplication(failures);
  return { ok: summary.ok, failures, summary };
}

function reportDuplication(failures) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[js-duplication] ${failure}`);
    console.error(`[js-duplication] ${failures.length} duplicate group(s) found.`);
    return;
  }
  console.log("JS duplication check passed.");
}

function collectFunctions(viewerRoot) {
  const out = [];
  if (!fs.existsSync(viewerRoot)) return out;
  for (const name of fs.readdirSync(viewerRoot).filter((n) => n.endsWith(".js")).sort()) {
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

function duplicateBlockFailures(entries) {
  const windows = new Map();
  for (const entry of entries) {
    if (entry.tokens.length < DUPLICATE_BLOCK_WINDOW) continue;
    for (let index = 0; index <= entry.tokens.length - DUPLICATE_BLOCK_WINDOW; index += 1) {
      const key = entry.tokens.slice(index, index + DUPLICATE_BLOCK_WINDOW).join(" ");
      if (!windows.has(key)) windows.set(key, []);
      windows.get(key).push({ entry, start: index, end: index + DUPLICATE_BLOCK_WINDOW });
    }
  }

  const pairs = new Map();
  for (const matches of windows.values()) {
    if (matches.length < 2) continue;
    for (let leftIndex = 0; leftIndex < matches.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < matches.length; rightIndex += 1) {
        addPairSegment(pairs, matches[leftIndex], matches[rightIndex]);
      }
    }
  }

  const out = [];
  const seen = new Set();
  for (const group of pairs.values()) {
    for (const segment of mergeSegments(group.segments)) {
      const tokenCount = segment.leftEnd - segment.leftStart;
      if (tokenCount < DUPLICATE_BLOCK_MIN_TOKENS) continue;
      const key = `${group.left.rel}:${group.left.line}:${group.right.rel}:${group.right.line}:${tokenCount}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(
        `duplicate function block across files: ${group.left.rel}:${group.left.line}, `
        + `${group.right.rel}:${group.right.line} (${tokenCount} tokens); `
        + "extract one canonical helper under window.Polarrecorder and reuse it"
      );
    }
  }
  return out.sort();
}

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
  if (!pairs.has(key)) {
    pairs.set(key, { left: left.entry, right: right.entry, segments: [] });
  }
  pairs.get(key).segments.push({
    leftStart: left.start,
    leftEnd: left.end,
    rightStart: right.start,
    rightEnd: right.end
  });
}

function mergeSegments(segments) {
  const sorted = segments
    .slice()
    .sort((a, b) => a.leftStart - b.leftStart || a.rightStart - b.rightStart);
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

// Offsets of the '{' that opens each function/arrow block body.
function functionBodyStarts(masked) {
  const starts = [];
  const patterns = [
    /\bfunction\b\s*[A-Za-z0-9_$]*\s*\([^)]*\)\s*\{/g,
    /=>\s*\{/g
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(masked)) !== null) {
      starts.push(match.index + match[0].length - 1);
    }
  }
  return starts;
}

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

function tokenize(body) {
  const tokens = [];
  let i = 0;
  while (i < body.length) {
    const char = body[i];
    if (/\s/.test(char)) { i += 1; continue; }
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

function consumeNumber(body, start, tokens) {
  let i = start;
  while (i < body.length && /[0-9a-fA-FxX._]/.test(body[i])) i += 1;
  tokens.push(`N:${body.slice(start, i)}`);
  return i;
}

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
    } else if (char === "\\") {
      chars[i] = " ";
      if (i + 1 < chars.length && chars[i + 1] !== "\n") { chars[i + 1] = " "; i += 1; }
    } else if (char === quote) {
      mode = "code";
      quote = "";
    } else if (char !== "\n") {
      chars[i] = " ";
    }
  }
  return chars.join("");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runJsDuplicationCheck().ok ? 0 : 1);
}
