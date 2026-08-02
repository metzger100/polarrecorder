#!/usr/bin/env node

/**
 * @file Local pattern-check adapter composing the portable rule runner and local rules.
 * Documentation: documentation/conventions/quality-gates.md
 */

import path from "node:path";
import { pathToFileURL } from "node:url";
import { runPatternCheck as runPortablePatternCheck } from "./check-patterns/runner.mjs";
import { getProjectPatternContext } from "./check-patterns/project/pattern-context.mjs";
import { GENERIC_RULES, PROJECT_RULES } from "./check-patterns/rules.mjs";

export const RULES = [...GENERIC_RULES, ...PROJECT_RULES];
export const PATTERN_RULE_IDS = Object.freeze(RULES.map((rule) => rule.name));

/** @param {{root?: string, warnMode?: boolean, print?: boolean}} [options] @returns {any} */
export function runPatternCheck(options = {}) {
  const root = path.resolve(options.root || process.cwd());
  return runPortablePatternCheck({
    ...options,
    root,
    rules: RULES,
    configuredExceptions: getProjectPatternContext(root).catchFallbackExceptions
  });
}

/** @param {string[]} [argv] @returns {void} */
export function runPatternCheckCli(argv = process.argv.slice(2)) {
  const warnMode = argv.includes("--warn");
  const { summary, findings } = runPatternCheck({ root: process.cwd(), warnMode, print: true });
  if (findings.length && !summary.warnMode) process.exit(1);
  process.exit(0);
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  runPatternCheckCli();
}
