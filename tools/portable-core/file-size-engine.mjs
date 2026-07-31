/**
 * Product-neutral file-size policy engine.
 */

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Check a supplied file inventory against a strict non-empty-line ceiling.
 * @param {{files: Record<string, string>, limit?: number}} options
 * @returns {PolicyResult}
 */
export function runFileSizePolicy({ files, limit = 400 }) {
  const failures = [];
  for (const [name, source] of Object.entries(files)) {
    const lines = source.split("\n").filter((line) => line.trim().length > 0).length;
    if (lines > limit) failures.push(`${name}: ${lines} non-empty lines exceeds ${limit}`);
  }
  return { ok: failures.length === 0, failures };
}
