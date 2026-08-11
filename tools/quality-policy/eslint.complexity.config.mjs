/**
 * Focused ESLint flat configuration enforcing the strict shipped-JavaScript complexity
 * budget directly, at error severity, from the single shared limit source in
 * `complexity-limits.mjs`. Every violation is an error; there is no baseline,
 * scanner, or budget ledger for ESLint to read, so a coordinated edit to policy data
 * alone can never authorize a violation. `npm run check:complexity` runs ESLint with
 * only this config against the shipped `viewer/*.js`, `plugin.js`, and `plugin.mjs`
 * files.
 */
import { STRICT_LIMITS } from "./complexity-limits.mjs";

const STRICT_COMPLEXITY_RULES = {
  complexity: ["error", STRICT_LIMITS.complexity],
  "max-statements": ["error", STRICT_LIMITS["max-statements"]],
  "max-depth": ["error", STRICT_LIMITS["max-depth"]],
  "max-params": ["error", STRICT_LIMITS["max-params"]]
};

export default [
  {
    files: ["viewer/*.js", "plugin.js"],
    languageOptions: { sourceType: "script", ecmaVersion: 2022 },
    linterOptions: { noInlineConfig: true },
    rules: STRICT_COMPLEXITY_RULES
  },
  {
    files: ["plugin.mjs"],
    languageOptions: { sourceType: "module", ecmaVersion: 2022 },
    linterOptions: { noInlineConfig: true },
    rules: STRICT_COMPLEXITY_RULES
  }
];
