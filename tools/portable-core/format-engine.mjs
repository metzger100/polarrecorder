/**
 * Product-neutral format-scope policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate unique format ownership and supported owner names.
 * @param {{rows: Array<{path: string, owner: string}>, owners: string[]}} options
 * @returns {PolicyResult}
 */
export function runFormatPolicy({ rows, owners }) {
  const failures = [];
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row.path)) failures.push(`duplicate format path: ${row.path}`);
    if (!owners.includes(row.owner)) failures.push(`${row.path}: unknown format owner ${row.owner}`);
    seen.add(row.path);
  }
  return { ok: failures.length === 0, failures };
}
