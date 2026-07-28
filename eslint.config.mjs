// Activated as part of `lint` (package.json) once ESLint adoption debt was zero. Layers
// @eslint/js's recommended rules (including no-undef, the generic dead-code/parse-error
// family, etc.) under the Polar-specific rules retired from tools/check-patterns.mjs
// (console.log, var, eval, bare isFinite, loose equality, ES-module syntax by scope, empty
// catch, and dead code) so every maintained JS/MJS file -- shipped runtime and tools/ alike
// -- gets the recommended baseline plus the repo-specific rules on top.
import js from "@eslint/js";
import jsdoc from "eslint-plugin-jsdoc";
import globals from "globals";

const classicScriptGlobals = {
  ...globals.browser,
  Polarrecorder: "writable"
};

const SUPPRESSION_COMMENT_TERMS = [
  "eslint-disable",
  "ts-ignore",
  "ts-nocheck",
  "ts-expect-error",
  "prettier-ignore",
  "istanbul ignore"
];

const GENERIC_JS_RULES = {
  ...js.configs.recommended.rules,
  eqeqeq: "error",
  "no-var": "error",
  "no-eval": "error",
  "no-implied-eval": "error",
  "no-new-func": "error",
  "no-unused-vars": ["error", { args: "none", vars: "all", caughtErrors: "all", caughtErrorsIgnorePattern: "^_" }],
  "no-warning-comments": ["error", { terms: SUPPRESSION_COMMENT_TERMS, location: "anywhere" }]
};

const SHIPPED_RUNTIME_RULES = {
  ...GENERIC_JS_RULES,
  "no-console": "error",
  "no-empty": ["error", { allowEmptyCatch: false }],
  "no-unreachable": "error",
  "no-constant-condition": "error",
  "no-restricted-globals": ["error", "isFinite", "isNaN"]
};

export default [
  {
    ignores: ["node_modules/**", "coverage/**", "venv/**", "releases/**", "exec-plans/**"]
  },
  {
    // Classic browser scripts: viewer/*.js and the legacy plugin.js entrypoint.
    files: ["viewer/*.js", "plugin.js"],
    languageOptions: {
      sourceType: "script",
      ecmaVersion: 2022,
      globals: classicScriptGlobals
    },
    linterOptions: { noInlineConfig: true },
    rules: SHIPPED_RUNTIME_RULES
  },
  {
    // plugin.mjs: shipped runtime ES module (same "no console.log in product code"
    // contract as viewer/*.js and plugin.js -- unlike the dev-tooling group below).
    files: ["plugin.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node }
    },
    linterOptions: { noInlineConfig: true },
    rules: SHIPPED_RUNTIME_RULES
  },
  {
    // Single maintained owner of the mandatory file-overview header: every viewer/*.js file
    // must carry a `@file` tag at the top, in place of the retired tools/check-headers.mjs.
    files: ["viewer/*.js"],
    plugins: { jsdoc },
    rules: { "jsdoc/require-file-overview": "error" }
  },
  {
    // Dev-only tooling: quality-gate scripts, tool config files, and Node tests. These
    // are CLI programs, so console output is their entire purpose (unlike shipped code).
    files: ["tools/**/*.mjs", "tests/js/**/*.mjs", "*.config.mjs"],
    languageOptions: {
      sourceType: "module",
      ecmaVersion: 2022,
      globals: { ...globals.node }
    },
    linterOptions: { noInlineConfig: true },
    rules: GENERIC_JS_RULES
  }
];
