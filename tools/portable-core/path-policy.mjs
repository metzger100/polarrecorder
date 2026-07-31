/**
 * Product-neutral filesystem policy helpers for portable quality tooling.
 */

import fs from "node:fs";
import path from "node:path";

/**
 * @typedef {{ok: true, absolutePath: string, relativePath: string} | {ok: false, reason: string}}
 * ContainedPathResult
 */

/**
 * Resolve a policy path without allowing absolute paths, traversal, or symlinks.
 * @param {string} root
 * @param {string} relativePath
 * @returns {ContainedPathResult}
 */
export function resolveContainedPath(root, relativePath) {
  if (path.isAbsolute(relativePath)) return { ok: false, reason: "absolute path is not allowed" };
  const normalized = path.posix.normalize(relativePath.split(path.sep).join("/"));
  if (normalized === "." || normalized.startsWith("../") || normalized.includes("/../")) {
    return { ok: false, reason: "path escapes the repository root" };
  }
  const rootPath = fs.realpathSync(root);
  const absolutePath = path.resolve(rootPath, normalized);
  if (absolutePath !== rootPath && !absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    return { ok: false, reason: "path escapes the repository root" };
  }
  const parts = path.relative(rootPath, absolutePath).split(path.sep).filter(Boolean);
  let current = rootPath;
  for (const part of parts) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) {
      return { ok: false, reason: "symlinked policy paths are not allowed" };
    }
  }
  return { ok: true, absolutePath, relativePath: normalized };
}

/**
 * Enumerate regular files beneath a root without following symlinks.
 * @param {string} root
 * @returns {string[]}
 */
export function listRegularFiles(root) {
  /** @type {string[]} */
  const output = [];
  if (!fs.existsSync(root)) return output;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    const absolutePath = path.join(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) output.push(...listRegularFiles(absolutePath));
    else if (entry.isFile()) output.push(absolutePath);
  }
  return output.sort();
}

/**
 * Convert a path under root into a stable POSIX-relative path.
 * @param {string} root
 * @param {string} absolutePath
 * @returns {string}
 */
export function relativePath(root, absolutePath) {
  return path.relative(root, absolutePath).split(path.sep).join("/");
}
