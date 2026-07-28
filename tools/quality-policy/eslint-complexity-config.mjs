/**
 * Single shared source for the four ESLint complexity-family limits (complexity,
 * max-statements, max-depth, max-params). No other file may redeclare these numeric
 * values together; `eslint.complexity.config.mjs` imports `STRICT_LIMITS` from here to
 * build its error-severity ESLint config. There is no baseline, scanner, or exception
 * ledger anywhere in this repository: a violating function fails outright.
 */

export const STRICT_LIMITS = Object.freeze({
  complexity: 10,
  "max-statements": 40,
  "max-depth": 4,
  "max-params": 6
});

/** @typedef {keyof typeof STRICT_LIMITS} ComplexityMetricKey */
