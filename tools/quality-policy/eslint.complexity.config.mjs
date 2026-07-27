/**
 * Focused ESLint flat configuration enforcing the strict shipped-JavaScript complexity
 * budget directly: complexity 10, max-statements 40, max-depth 4, max-params 6. Every
 * violation is an error; there is no baseline, scanner, or budget ledger for ESLint to
 * read, so a coordinated edit to policy data alone can never authorize a violation.
 * `npm run check:complexity` runs ESLint with only this config against the shipped
 * `viewer/*.js`, `plugin.js`, and `plugin.mjs` files.
 */
const STRICT_COMPLEXITY_RULES = {
  complexity: ["error", 10],
  "max-statements": ["error", 40],
  "max-depth": ["error", 4],
  "max-params": ["error", 6]
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
