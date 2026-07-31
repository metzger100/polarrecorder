/**
 * Single shared source for the four ESLint complexity-family limits (complexity,
 * max-statements, max-depth, max-params). No other file may redeclare these numeric
 * values together; `eslint.complexity.config.mjs` imports `STRICT_LIMITS` from here to
 * build its error-severity ESLint config. There is no baseline, scanner, or exception
 * ledger anywhere in this repository: a violating function fails outright.
 */

import { runComplexityPolicy, STRICT_LIMITS as PORTABLE_LIMITS } from "../portable-core/complexity-engine.mjs";

const portablePolicy = runComplexityPolicy({ limits: PORTABLE_LIMITS });
if (!portablePolicy.ok) throw new Error(portablePolicy.failures.join("\n"));

export const STRICT_LIMITS = Object.freeze({
  complexity: PORTABLE_LIMITS.complexity,
  "max-statements": PORTABLE_LIMITS.statements,
  "max-depth": PORTABLE_LIMITS.depth,
  "max-params": PORTABLE_LIMITS.params
});

/** @typedef {keyof typeof STRICT_LIMITS} ComplexityMetricKey */
