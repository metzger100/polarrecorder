/**
 * Product-neutral test-inventory policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate a strict, duplicate-free test inventory.
 * @param {{entries: Record<string, {classification: string}>, livePaths: string[]}} options
 * @returns {PolicyResult}
 */
export function runTestInventoryPolicy({ entries, livePaths }) {
  const failures = [];
  const live = new Set(livePaths);
  if (live.size !== livePaths.length) failures.push("live inventory paths must be duplicate-free");
  for (const [name, entry] of Object.entries(entries)) {
    if (!live.has(name)) failures.push(`${name}: stale inventory entry`);
    if (entry.classification !== "strict" && entry.classification !== "fixture") {
      failures.push(`${name}: unknown classification`);
    }
  }
  for (const name of live) {
    if (!Object.prototype.hasOwnProperty.call(entries, name)) failures.push(`${name}: missing inventory entry`);
  }
  return { ok: failures.length === 0, failures };
}
