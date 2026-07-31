/**
 * Product-neutral normalized coverage policy engine.
 */

/**
 * @typedef {{lines: number, functions: number, statements: number, branches: number}}
 * CoverageSummary
 */
/** @typedef {{ok: boolean, failures: string[]}} PolicyResult */

/**
 * Normalize one adapter-owned coverage summary and reject malformed counters.
 * @param {Record<string, unknown>} raw
 * @returns {{ok: true, value: CoverageSummary} | {ok: false, failures: string[]}}
 */
export function normalizeCoverageSummary(raw) {
  const failures = [];
  const fields = ["lines", "functions", "statements", "branches"];
  for (const field of fields) {
    const value = raw[field];
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) {
      failures.push(`${field}: normalized coverage must be a finite percentage`);
    }
  }
  if (failures.length > 0) return { ok: false, failures };
  return {
    ok: true,
    value: /** @type {CoverageSummary} */ ({
      lines: raw.lines,
      functions: raw.functions,
      statements: raw.statements,
      branches: raw.branches
    })
  };
}

/**
 * Validate a normalized summary and floor ratchet.
 * @param {{summary: Record<string, CoverageSummary>, floors: Record<string, number>, baseline?: Record<string, number>}}
 * options
 * @returns {PolicyResult}
 */
export function runCoveragePolicy({ summary, floors, baseline = {} }) {
  const failures = [];
  if (Object.keys(floors).length === 0) failures.push("coverage floors cannot be empty");
  for (const [name, value] of Object.entries(summary)) {
    const normalized = normalizeCoverageSummary(value);
    if (!normalized.ok) failures.push(...normalized.failures.map((failure) => `${name}: ${failure}`));
  }
  for (const [name, floor] of Object.entries(floors)) {
    const current = summary[name]?.lines;
    if (typeof current !== "number") failures.push(`${name}: missing normalized summary`);
    else if (current < floor) failures.push(`${name}: below configured floor`);
    if (typeof baseline[name] === "number" && floor < baseline[name]) failures.push(`${name}: floor was lowered`);
  }
  return { ok: failures.length === 0, failures };
}
