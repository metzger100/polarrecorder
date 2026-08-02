import { PYTHON_PROJECT_RULES } from "./project/python-rules.mjs";
import { JS_PROJECT_RULES } from "./project/js-rules.mjs";
import { NAMESPACE_TOKEN_CONSISTENCY_RULES } from "./project/namespace-token-consistency.mjs";
import { getFileData, scopeFor } from "./shared.mjs";
import { runRegexRule } from "./rules-core.mjs";
import { CANONICAL_GENERIC_RULE_IDS, runGenericRule } from "../portable-core/generic-rule-engine.mjs";

export { runRegexRule };

/**
 * @typedef {import("./shared.mjs").Rule} Rule
 */

/** @param {any} rule @param {string[]} files @returns {any[]} */
function runSignedGenericRule(rule, files) {
  const descriptors = files.map((file) => ({ path: file, content: getFileData(file).text }));
  return runGenericRule(rule.name, descriptors, {
    canvasAliases: ["ctx"],
    frameworkRoots: ["Helpers", "Polarrecorder"]
  }).map((finding) => ({
    file: finding.path,
    line: finding.line,
    message: finding.message
  }));
}

const GENERIC_SCOPE_KEYS = Object.freeze({
  "absolute-home-path": "absolute-home-path",
  "exec-plan-reference": "exec-plan-reference",
  "no-nul-byte": "no-nul-byte",
  "unsafe-html-dom-sink": "js-runtime-default",
  "dead-code": "js-runtime-default",
  "console-in-runtime": "console-in-runtime",
  "default-truthy-fallback": "js-runtime-default",
  "redundant-null-type-guard": "js-runtime-default",
  "empty-catch": "js-runtime-default",
  "premature-legacy-support": "js-runtime-default",
  "unused-fallback": "js-runtime-default",
  "responsive-layout-hard-floor": "js-runtime-default",
  "canvas-api-typeof-guard": "js-runtime-default",
  "try-finally-canvas-drawing": "js-runtime-default",
  "todo-without-owner": "todo-without-owner",
  "duplicate-functions": "duplication-source",
  "duplicate-block-clones": "duplication-source",
  "catch-fallback-without-suppression": "js-runtime-default",
  "internal-contract-fallback": "js-runtime-default",
  "framework-method-typeof-guard": "js-runtime-default",
  "invalid-lint-suppression": "generic-source"
});
const CANONICAL_GENERIC_RULE_SET = new Set(CANONICAL_GENERIC_RULE_IDS);

/** @type {Rule[]} */
export const GENERIC_RULES = CANONICAL_GENERIC_RULE_IDS.map((name) => ({
  id: name,
  name,
  severity: /** @type {"block"} */ ("block"),
  scope: scopeFor(GENERIC_SCOPE_KEYS[/** @type {keyof typeof GENERIC_SCOPE_KEYS} */ (name)]),
  run: runSignedGenericRule,
  message: () => `[${name}] canonical signed generic rule`
}));

// Rule ids that encode product-specific runtime or namespace contracts.
/** @type {Rule[]} */
export const PROJECT_RULES = [
  ...PYTHON_PROJECT_RULES.filter((rule) => !CANONICAL_GENERIC_RULE_SET.has(rule.name)),
  ...JS_PROJECT_RULES.filter((rule) => !CANONICAL_GENERIC_RULE_SET.has(rule.name)),
  ...NAMESPACE_TOKEN_CONSISTENCY_RULES
];

// Registry order is cosmetic only (console grouping), never behavior-affecting.
/** @type {Rule[]} */
export const RULES = [...GENERIC_RULES, ...PROJECT_RULES];
