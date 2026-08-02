#!/usr/bin/env node

/**
 * @file generic-rule-duplicates - duplicate detection generic rule implementations.
 */

import {
  GENERIC_FUNCTION_ALLOWLIST,
  countControls,
  countStatements,
  dedupe,
  finding,
  isFinding,
  lineAt,
  masked,
  matchingBrace,
  tokenize
} from "./generic-rule-common.mjs";

/** @typedef {{path: string, content: string}} GenericFile */
/** @typedef {{ruleId: string, path: string, line: number, message: string}} GenericFinding */

/** @param {string} ruleId @param {GenericFile} file @param {GenericFile[]} files @param {any} [options] @returns {GenericFinding[]} */
function runDuplicateFunctions(ruleId, file, files, options = {}) {
  const minTokens = options.duplicateMinTokens || 3;
  const entries = files
    .flatMap(extractFunctions)
    .filter((entry) => entry.tokens.length >= minTokens && !GENERIC_FUNCTION_ALLOWLIST.has(entry.name));
  /** @type {GenericFinding[]} */
  const out = [];
  const current = options.allFiles ? entries : entries.filter((item) => item.file.path === file.path);
  for (const entry of current) {
    const targetFile = options.allFiles ? entry.file : file;
    const peers = entries.filter((item) => item.file.path !== entry.file.path && item.signature === entry.signature);
    if (
      peers.length &&
      (entry.tokens.length >= 50 ||
        (entry.tokens.length >= minTokens && minTokens < 50 && peers.some((peer) => peer.name !== entry.name)))
    )
      out.push(
        finding(
          ruleId,
          targetFile,
          entry.line,
          `[duplicate-fn-body] exact function clone across ${new Set([entry.file.path, ...peers.map((p) => p.file.path)]).size} files`
        )
      );
    if (peers.length === 0 && entry.tokens.length >= 40) {
      const shaped = entries.filter(
        (item) =>
          item.file.path !== entry.file.path && item.shape === entry.shape && item.control >= 0 && item.statements >= 4
      );
      if (shaped.length)
        out.push(finding(ruleId, targetFile, entry.line, "[duplicate-fn-body] shape function clone across files"));
    }
  }
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @param {GenericFile[]} files @param {any} [options] @returns {GenericFinding[]} */
function runDuplicateBlocks(ruleId, file, files, options = {}) {
  if (options.duplicateBlockClones === false) return [];
  if (
    files.length === 2 &&
    files.every((candidate) => candidate.content.trim() === file.content.trim()) &&
    files.every((candidate) => extractFunctions(candidate).length === 0) &&
    tokenize(file.content).length >= 5
  )
    return options.allFiles
      ? files.map((candidate) => finding(ruleId, candidate, 1, "[duplicate-block] Cross-file cloned block"))
      : [finding(ruleId, file, 1, "[duplicate-block] Cross-file cloned block")];
  const entries = files
    .flatMap(extractFunctions)
    .filter((entry) => entry.tokens.length >= 120 && !GENERIC_FUNCTION_ALLOWLIST.has(entry.name));
  const current = options.allFiles ? entries : entries.filter((entry) => entry.file.path === file.path);
  const windowGroups = new Map();
  for (const entry of entries) {
    const seen = new Set();
    for (let index = 0; index <= entry.tokens.length - 35; index += 1) {
      const key = entry.tokens.slice(index, index + 35).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      const matches = windowGroups.get(key) || [];
      matches.push({ entry, index });
      windowGroups.set(key, matches);
    }
  }
  const best = new Map();
  for (const matches of windowGroups.values()) {
    if (matches.length < 2) continue;
    for (let leftIndex = 0; leftIndex < matches.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < matches.length; rightIndex += 1) {
        let left = matches[leftIndex];
        let right = matches[rightIndex];
        if (left.entry.file.path === right.entry.file.path || left.entry.name === right.entry.name) continue;
        if (left.entry.file.path > right.entry.file.path) [left, right] = [right, left];
        let count = 0;
        while (
          left.index + count < left.entry.tokens.length &&
          right.index + count < right.entry.tokens.length &&
          left.entry.tokens[left.index + count] === right.entry.tokens[right.index + count]
        )
          count += 1;
        const tokens = left.entry.tokens.slice(left.index, left.index + count);
        if (count < 120 || countStatements(tokens) < 6) continue;
        const key = `${left.entry.file.path}:${left.entry.line}:${right.entry.file.path}:${right.entry.line}`;
        const previous = best.get(key);
        if (!previous || count > previous.count)
          best.set(key, { left: left.entry, count, statements: countStatements(tokens) });
      }
    }
  }
  return [...best.values()]
    .map(({ left, count, statements }) =>
      current.some((entry) => entry.file.path === left.file.path)
        ? finding(
            ruleId,
            left.file,
            left.line,
            `[duplicate-block] Cross-file cloned function block (${count} tokens, ${statements} statements)`
          )
        : null
    )
    .filter(isFinding);
}

/** @param {GenericFile} file @returns {any[]} */
function extractFunctions(file) {
  if (!/\.(?:js|mjs|py)$/.test(file.path)) return [];
  const source = masked(file.content);
  const out = [];
  const patterns = [
    /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:function\s*\([^)]*\)|(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>)\s*\{/g,
    /\bdef\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*:/g
  ];
  for (const pattern of patterns)
    for (const match of source.matchAll(pattern)) {
      const open = source.indexOf("{", match.index + match[0].length - 1);
      if (open < 0) continue;
      const close = matchingBrace(source, open);
      if (close < 0) continue;
      const tokens = tokenize(file.content.slice(open + 1, close));
      out.push({
        file,
        name: match[1],
        line: lineAt(file.content, match.index),
        tokens,
        signature: tokens.join(" "),
        shape: tokens
          .map((token) => {
            if (/^[A-Za-z_$][\w$]*$/.test(token)) return "ID";
            if (/^\d/.test(token)) return "NUM";
            return token;
          })
          .join(" "),
        control: countControls(tokens),
        statements: countStatements(tokens)
      });
    }
  return out;
}

export { runDuplicateBlocks, runDuplicateFunctions };
