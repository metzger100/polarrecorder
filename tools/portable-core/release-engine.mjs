/**
 * Product-neutral release policy engine.
 */

import path from "node:path";

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate semantic versions, local payload paths, and exact normalized parity.
 * @param {{version: string, payload: string[], baselinePayload?: string[]}} options
 * @returns {PolicyResult}
 */
export function runReleasePolicy({ version, payload, baselinePayload = payload }) {
  const failures = [];
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version))
    failures.push("invalid semantic version");
  const normalized = payload.map((entry) => path.posix.normalize(entry.split(path.sep).join("/")));
  if (normalized.some((entry) => entry.startsWith("../") || path.posix.isAbsolute(entry))) {
    failures.push("release payload escapes its root");
  }
  if (JSON.stringify([...normalized].sort()) !== JSON.stringify([...baselinePayload].sort())) {
    failures.push("release payload parity changed");
  }
  return { ok: failures.length === 0, failures };
}
