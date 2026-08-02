#!/usr/bin/env node

/**
 * @file generic-rule-engine - product-neutral executable rules and normalized findings.
 * Documentation: documentation/conventions/quality-gates.md
 *
 * The rule implementations live in focused portable modules so every maintained file stays
 * reviewable. This module is the only public registry and dispatch boundary.
 */

import { compareFindings } from "./generic-rule-common.mjs";
import {
  runCanvasGuard,
  runDeadCode,
  runNoNul,
  runRedundantNull,
  runResponsive,
  runSimple,
  runTodo,
  runTryFinally,
  runUnusedFallback
} from "./generic-rule-structural.mjs";
import {
  runCatchFallback,
  runFrameworkGuard,
  runInternalFallback,
  runInvalidSuppression,
  runUnsafeSink
} from "./generic-rule-contracts.mjs";
import { runDuplicateBlocks, runDuplicateFunctions } from "./generic-rule-duplicates.mjs";

export const CANONICAL_GENERIC_RULE_IDS = Object.freeze([
  "absolute-home-path",
  "exec-plan-reference",
  "no-nul-byte",
  "unsafe-html-dom-sink",
  "dead-code",
  "console-in-runtime",
  "default-truthy-fallback",
  "redundant-null-type-guard",
  "empty-catch",
  "premature-legacy-support",
  "unused-fallback",
  "responsive-layout-hard-floor",
  "canvas-api-typeof-guard",
  "try-finally-canvas-drawing",
  "todo-without-owner",
  "duplicate-functions",
  "duplicate-block-clones",
  "catch-fallback-without-suppression",
  "internal-contract-fallback",
  "framework-method-typeof-guard",
  "invalid-lint-suppression"
]);

/** @typedef {{path: string, content: string}} GenericFile */
/** @typedef {{ruleId: string, path: string, line: number, message: string}} GenericFinding */
/** @typedef {(ruleId: string, file: GenericFile, files: GenericFile[], options: any) => GenericFinding[]} GenericRunner */

/** @type {Record<string, GenericRunner>} */
const RUNNERS = {
  "no-nul-byte": runNoNul,
  "todo-without-owner": runTodo,
  "unused-fallback": runUnusedFallback,
  "dead-code": (ruleId, file, _files, options) => runDeadCode(ruleId, file, options),
  "redundant-null-type-guard": runRedundantNull,
  "responsive-layout-hard-floor": runResponsive,
  "canvas-api-typeof-guard": (ruleId, file, _files, options) => runCanvasGuard(ruleId, file, options),
  "try-finally-canvas-drawing": runTryFinally,
  "unsafe-html-dom-sink": (ruleId, file, _files, options) => runUnsafeSink(ruleId, file, options),
  "catch-fallback-without-suppression": (ruleId, file) => runCatchFallback(ruleId, file),
  "internal-contract-fallback": (ruleId, file, _files, options) => runInternalFallback(ruleId, file, options),
  "framework-method-typeof-guard": (ruleId, file, _files, options) => runFrameworkGuard(ruleId, file, options),
  "invalid-lint-suppression": runInvalidSuppression,
  "duplicate-functions": runDuplicateFunctions,
  "duplicate-block-clones": runDuplicateBlocks
};

/**
 * Run one canonical rule against explicit repository-relative file descriptors.
 * @param {string} ruleId
 * @param {GenericFile[]} files
 * @param {{canvasAliases?: string[], frameworkRoots?: string[], sinkAllowlist?: Record<string, Array<{pattern: string, count: number}>>}} [options]
 * @returns {GenericFinding[]}
 */
export function runGenericRule(ruleId, files, options = {}) {
  if (!CANONICAL_GENERIC_RULE_IDS.includes(ruleId)) throw new Error(`Unknown canonical generic rule '${ruleId}'.`);
  const runner = RUNNERS[ruleId] || runSimple;
  if (ruleId === "duplicate-functions" || ruleId === "duplicate-block-clones") {
    return files.length ? runner(ruleId, files[0], files, { ...options, allFiles: true }) : [];
  }
  return files.flatMap((file) => runner(ruleId, file, files, options)).sort(compareFindings);
}

/** @param {GenericFile[]} files @param {Record<string, unknown>} [options] @returns {GenericFinding[]} */
export function runGenericConformance(files, options = {}) {
  return CANONICAL_GENERIC_RULE_IDS.flatMap((id) => runGenericRule(id, files, options)).sort(compareFindings);
}
