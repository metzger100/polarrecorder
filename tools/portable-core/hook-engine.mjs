/**
 * Product-neutral hook policy engine.
 */

import fs from "node:fs";

import { resolveContainedPath } from "./path-policy.mjs";

/**
 * @typedef {{ok: boolean, failures: string[]}}
 * PolicyResult
 */

/**
 * Validate hook paths and executable mode without discovering other roots.
 * @param {{root: string, paths: string[]}} options
 * @returns {PolicyResult}
 */
export function runHookPolicy({ root, paths }) {
  const failures = [];
  for (const relativePath of paths) {
    const contained = resolveContainedPath(root, relativePath);
    if (!contained.ok) failures.push(`${relativePath}: ${contained.reason}`);
    else if (!fs.existsSync(contained.absolutePath)) failures.push(`${relativePath}: missing hook`);
    else if ((fs.statSync(contained.absolutePath).mode & 0o111) === 0)
      failures.push(`${relativePath}: hook is not executable`);
  }
  return { ok: failures.length === 0, failures };
}
