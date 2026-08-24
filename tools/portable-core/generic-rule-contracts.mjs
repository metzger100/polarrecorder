#!/usr/bin/env node

/**
 * @file generic-rule-contracts - contract-boundary generic rule implementations.
 */

import { dedupe, escapeRegex, finding, masked, matchingBrace, lineAt } from "./generic-rule-common.mjs";

/** @typedef {{path: string, content: string}} GenericFile */
/** @typedef {{ruleId: string, path: string, line: number, message: string}} GenericFinding */

/** @param {string} ruleId @param {GenericFile} file @param {any} options @returns {GenericFinding[]} */
function runUnsafeSink(ruleId, file, options) {
  const source = masked(file.content);
  /** @type {GenericFinding[]} */
  const out = [];
  const seen = new Set();
  /** @type {Array<any>} */
  const allow = options.sinkAllowlist?.[file.path] || [];
  /** @param {number} index @param {string} name @param {string} [lineText] */
  const add = (index, name, lineText = "") => {
    const line = lineAt(file.content, index);
    const key = `${line}:${name}`;
    if (seen.has(key)) return;
    const allowed = allow.find((entry) => new RegExp(entry.pattern).test(lineText) && (entry.used || 0) < entry.count);
    if (allowed) {
      allowed.used = (allowed.used || 0) + 1;
      return;
    }
    seen.add(key);
    out.push(finding(ruleId, file, line, `unsafe HTML DOM sink '${name}' detected`));
  };
  for (const match of source.matchAll(
    options.unsafeInlineHandlers === false
      ? /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.(innerHTML|outerHTML)\s*(?:\+?=)/g
      : /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.(innerHTML|outerHTML|on[a-z][\w-]*)\s*(?:\+?=)/g
  ))
    add(match.index, match[1], file.content.slice(match.index, match.index + 180));
  for (const match of file.content.matchAll(/\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\s*\[[^\]]+\]\s*(?:\+?=)/g)) {
    const text = file.content.slice(match.index, match.index + 180);
    if (
      /innerHTML|outerHTML|htmlSink|["'`]\s*\+|\+\s*["'`]/i.test(text) ||
      (options.unsafeInlineHandlers !== false && /\bon[a-z]|handlerName/i.test(text))
    )
      add(match.index, "computed HTML/event sink", text);
  }
  if (options.unsafeInlineHandlers !== false)
    for (const match of file.content.matchAll(
      /\b[A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*\.setAttribute\s*\(([^,]+),/g
    )) {
      const attribute = match[1].trim();
      if (
        /^['"`]on[a-z][\w-]*['"`]$/i.test(attribute) ||
        /^(?:handlerName|htmlSink)$/i.test(attribute) ||
        /^['"`]on['"`]\s*\+/.test(attribute)
      )
        add(match.index, "inline event-handler assignment", file.content.slice(match.index, match.index + 160));
    }
  for (const match of file.content.matchAll(/\bdocument\s*(?:\.\s*(?:write|writeln)|\[[^\]]+\])\s*\(/g))
    add(match.index, "document.write", file.content.slice(match.index, match.index + 100));
  return out;
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runCatchFallback(ruleId, file) {
  const source = masked(file.content),
    out = /** @type {GenericFinding[]} */ ([]);
  for (const match of source.matchAll(/(?<![.\w])catch\s*\([^)]*\)\s*\{/g)) {
    const open = source.indexOf("{", match.index),
      close = matchingBrace(source, open);
    if (open < 0 || close < 0) continue;
    const body = source.slice(open + 1, close).trim();
    if (!body || /\bthrow\b/.test(body)) continue;
    const line = lineAt(file.content, match.index);
    const explicitBoundaryResult = /\breturn\s+\{\s*ok\s*:\s*false\b/.test(body);
    const visibleFailureState = /\.(?:textContent|hidden|className)\s*=/.test(body);
    if (explicitBoundaryResult || visibleFailureState) continue;
    out.push(finding(ruleId, file, line, "Non-rethrow catch detected (catch (...) { ... })"));
  }
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @param {any} [options] @returns {GenericFinding[]} */
function runInternalFallback(ruleId, file, options = {}) {
  const source = masked(file.content),
    out = /** @type {GenericFinding[]} */ ([]);
  for (const match of source.matchAll(/\bfunction\s+(normalize[A-Za-z_$][\w$]*)\s*\(([^)]*)\)/g)) {
    if (/fallback/i.test(match[2]))
      out.push(
        finding(
          ruleId,
          file,
          lineAt(file.content, match.index),
          `Internal hook/spec fallback detected (function ${match[1]}(...))`
        )
      );
  }
  const sourceFallbackPattern = /\bcfg\.[A-Za-z_$][\w$.]*\s*\([^;\n]*\)\s*(?:\|\||\?\?)/g;
  for (const match of source.matchAll(sourceFallbackPattern))
    out.push(
      finding(
        ruleId,
        file,
        lineAt(file.content, match.index),
        `Internal hook/spec fallback detected (${match[0].trim()})`
      )
    );
  const trustedRoots = options.frameworkRoots || ["Helpers"];
  const namespaceFallbackPattern = new RegExp(
    `\\b(?:${trustedRoots.map(escapeRegex).join("|")})\\.[A-Za-z_$][\\w$.]*\\s*\\([^;\\n]*\\)\\s*(?:\\|\\||\\?\\?)`,
    "g"
  );
  for (const match of source.matchAll(namespaceFallbackPattern))
    out.push(
      finding(
        ruleId,
        file,
        lineAt(file.content, match.index),
        `Internal hook/spec fallback detected (${match[0].trim()})`
      )
    );
  if (options.internalContractFallbackMode !== "legacy")
    for (const match of source.matchAll(/\b(?:result|value|data)\s*(?:\|\||\?\?)\s*(?:\{\}|\[\]|undefined|null)/g))
      out.push(
        finding(
          ruleId,
          file,
          lineAt(file.content, match.index),
          `Internal hook/spec fallback detected (${match[0].trim()})`
        )
      );
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @param {any} options @returns {GenericFinding[]} */
function runFrameworkGuard(ruleId, file, options) {
  const roots = options.frameworkRoots || null;
  const source = file.content,
    out = /** @type {GenericFinding[]} */ ([]),
    aliases = new Set();
  for (const root of roots || ["Helpers"]) {
    const re = new RegExp(`\\bconst\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegex(root)}\\.getModule\\s*\\(`, "g");
    for (const match of source.matchAll(re)) aliases.add(match[1]);
  }
  const guard = /typeof\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*===\s*["']function["']/g;
  for (const match of source.matchAll(guard)) {
    const root = match[1].split(".")[0];
    if (roots && !roots.includes(root) && !aliases.has(root)) continue;
    out.push(
      finding(
        ruleId,
        file,
        lineAt(file.content, match.index),
        `Redundant typeof guard on trusted framework method ${match[1]}`
      )
    );
  }
  return dedupe(out);
}

/** @param {string} ruleId @param {GenericFile} file @returns {GenericFinding[]} */
function runInvalidSuppression(ruleId, file) {
  /** @type {GenericFinding[]} */
  const out = [];
  const lines = file.content.split(/\r?\n/);
  lines.forEach((line, index) => {
    const lint = /plugin-lint-disable-(?:next-line|line)\s+([a-z0-9-]+)/.exec(line);
    const legacyLint = /eslint-(?:disable|enable)(?:-(?:next-line|line))?\b[^\n]*/.exec(line);
    if (lint)
      out.push(
        finding(
          ruleId,
          file,
          index + 1,
          `Generic production suppression for '${lint[1]}' is forbidden; use a checker-owned exception.`
        )
      );
    else if (/plugin-lint-disable-/.test(line))
      out.push(finding(ruleId, file, index + 1, "Malformed suppression directive."));
    if (legacyLint)
      out.push(finding(ruleId, file, index + 1, `Retired lint suppression '${legacyLint[0].trim()}' is forbidden.`));
    if (/plugin-boundary-/.test(line))
      out.push(finding(ruleId, file, index + 1, "Boundary suppression markers are forbidden."));
    if (
      /\b(?:#\s*noqa\b|#\s*type:\s*ignore\b|#\s*ruff\s*:\s*noqa(?!\s*:)|#\s*flake8\s*:\s*noqa\b|#\s*mypy\s*:\s*ignore-errors)/i.test(
        line
      )
    ) {
      if (!/#\s*noqa\s*:\s*[A-Z]+\d+.*#\s*\S/i.test(line) && !/#\s*type:\s*ignore\[[^\]]+\].*#\s*\S/i.test(line))
        out.push(finding(ruleId, file, index + 1, "Invalid blanket lint suppression."));
    }
  });
  return out;
}

export { runCatchFallback, runFrameworkGuard, runInternalFallback, runInvalidSuppression, runUnsafeSink };

/** @param {string} ruleId @param {GenericFile} file @param {GenericFile[]} files @returns {GenericFinding[]} */
/** @param {string} ruleId @param {GenericFile} file @param {GenericFile[]} files @param {any} [options] @returns {GenericFinding[]} */
