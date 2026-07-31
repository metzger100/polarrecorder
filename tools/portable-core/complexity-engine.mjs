/**
 * Product-neutral complexity policy engine.
 */

export const STRICT_LIMITS = Object.freeze({ complexity: 10, statements: 40, depth: 4, params: 6 });

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate strict limits and an optional immutable baseline of findings.
 * @param {{limits: Record<string, number>, baseline?: Record<string, number>, findings?: Record<string, number>}}
 * options
 * @returns {PolicyResult}
 */
export function runComplexityPolicy({ limits, baseline = {}, findings = {} }) {
  const failures = [];
  for (const [key, value] of Object.entries(STRICT_LIMITS)) {
    if (limits[key] !== value) failures.push(`strict limit ${key} must equal ${value}`);
  }
  for (const [name, value] of Object.entries(findings)) {
    const previous = baseline[name];
    if (previous === undefined && value > 0) failures.push(`${name}: strict mode does not permit a new finding`);
    if (previous !== undefined && value > previous) failures.push(`${name}: complexity finding increased`);
  }
  return { ok: failures.length === 0, failures };
}
