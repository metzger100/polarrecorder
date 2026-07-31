/**
 * Product-neutral documentation-link policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Check relative link targets against a supplied local file set.
 * @param {{links?: Record<string, string[]>; files?: string[], broken?: string[]}} options
 * @returns {PolicyResult}
 */
export function runDocumentationLinkPolicy({ links = {}, files = [], broken = [] }) {
  const failures = [...broken];
  const known = new Set(files);
  for (const [owner, targets] of Object.entries(links)) {
    for (const target of targets) {
      if (target.startsWith("/") || target.includes("..")) failures.push(`${owner}: unsafe target ${target}`);
      else if (!known.has(target)) failures.push(`${owner}: missing target ${target}`);
    }
  }
  return { ok: failures.length === 0, failures };
}
