import { LINE_GENERIC_RULES } from "./generic/rules-regex-generic-defs.mjs";
import { STRUCTURAL_GENERIC_RULES } from "./generic/rules-core-generic-defs.mjs";
import { TODO_WITHOUT_OWNER_GENERIC_RULES } from "./generic/rules-failfast-generic-defs.mjs";
import { DUPLICATION_GENERIC_RULES } from "./generic/duplication-rules.mjs";
import { PYTHON_PROJECT_RULES } from "./project/python-rules.mjs";
import { JS_PROJECT_RULES } from "./project/js-rules.mjs";
import { NAMESPACE_TOKEN_CONSISTENCY_RULES } from "./project/namespace-token-consistency.mjs";
import { runRegexRule } from "./rules-core.mjs";

export { runRegexRule };

/**
 * @typedef {import("./shared.mjs").Rule} Rule
 */

// Rule ids depending on no product concept; their paths and scopes come from project-owned data.
/** @type {Set<string>} */
const RECLASSIFIED_GENERIC_NAMES = new Set([
  "catch-fallback-without-suppression",
  "internal-contract-fallback",
  "framework-method-typeof-guard",
  "invalid-lint-suppression"
]);

export const GENERIC_RULES = [
  ...LINE_GENERIC_RULES,
  ...STRUCTURAL_GENERIC_RULES,
  ...TODO_WITHOUT_OWNER_GENERIC_RULES,
  ...DUPLICATION_GENERIC_RULES,
  ...JS_PROJECT_RULES.filter((rule) => RECLASSIFIED_GENERIC_NAMES.has(rule.name)),
  ...PYTHON_PROJECT_RULES.filter((rule) => RECLASSIFIED_GENERIC_NAMES.has(rule.name))
];

// Rule ids that encode product-specific runtime or namespace contracts.
/** @type {Rule[]} */
export const PROJECT_RULES = [
  ...PYTHON_PROJECT_RULES.filter((rule) => !RECLASSIFIED_GENERIC_NAMES.has(rule.name)),
  ...JS_PROJECT_RULES.filter((rule) => !RECLASSIFIED_GENERIC_NAMES.has(rule.name)),
  ...NAMESPACE_TOKEN_CONSISTENCY_RULES
];

// Registry order is cosmetic only (console grouping), never behavior-affecting.
/** @type {Rule[]} */
export const RULES = [...GENERIC_RULES, ...PROJECT_RULES];
