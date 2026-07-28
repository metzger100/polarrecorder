import { LINE_GENERIC_RULES } from "./generic/line-rules.mjs";
import { STRUCTURAL_GENERIC_RULES } from "./generic/structural-rules.mjs";
import { TODO_WITHOUT_OWNER_GENERIC_RULES } from "./generic/todo-without-owner.mjs";
import { PYTHON_PROJECT_RULES } from "./project/python-rules.mjs";
import { JS_PROJECT_RULES } from "./project/js-rules.mjs";
import { NAMESPACE_TOKEN_CONSISTENCY_RULES } from "./project/namespace-token-consistency.mjs";

/**
 * @typedef {import("./shared.mjs").Rule} Rule
 */

// Rule ids depending on no Polar Recorder concept: no project token in the regex, message, or
// scope beyond the generic viewer/JS file-discovery functions.
/** @type {Rule[]} */
export const GENERIC_RULES = [...LINE_GENERIC_RULES, ...STRUCTURAL_GENERIC_RULES, ...TODO_WITHOUT_OWNER_GENERIC_RULES];

// Rule ids referencing server/polarrecorder/, plugin.py's import contract, the Polarrecorder
// namespace token, or the ConfigCache/Placeholders boundary owners.
/** @type {Rule[]} */
export const PROJECT_RULES = [...PYTHON_PROJECT_RULES, ...JS_PROJECT_RULES, ...NAMESPACE_TOKEN_CONSISTENCY_RULES];

// Registry order is cosmetic only (console grouping), never behavior-affecting.
/** @type {Rule[]} */
export const RULES = [...GENERIC_RULES, ...PROJECT_RULES];
