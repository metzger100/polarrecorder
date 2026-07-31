/**
 * Product-neutral focused-test policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Reject test focus markers from a supplied source inventory.
 * @param {{files?: Record<string, string>, findings?: string[]}} options
 * @returns {PolicyResult}
 */
export function runFocusedTestPolicy({ files = {}, findings = [] }) {
  const failures = [...findings];
  const marker = /\.(?:only|skip|todo)\s*\(|\b(?:fdescribe|fit|xdescribe|xit|xtest)\s*\(/;
  for (const [name, source] of Object.entries(files)) {
    if (marker.test(source)) failures.push(`${name}: focused test marker found`);
  }
  return { ok: failures.length === 0, failures };
}
