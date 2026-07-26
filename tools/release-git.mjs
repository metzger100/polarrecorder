#!/usr/bin/env node

/**
 * NUL-safe `git status --porcelain=v1 -z` parser, shared by
 * `release-prepare.mjs`/`release-create.mjs` so dirty-tree detection never breaks on a
 * path containing a space, and rename/copy entries (which carry two NUL-terminated
 * path fields -- the new name first, then the original name) are never
 * misinterpreted as two independent single-path entries.
 */

/** @typedef {{x: string, y: string, path: string, origPath: string | null}} StatusEntry */

const RENAME_OR_COPY = new Set(["R", "C"]);

/**
 * @param {string} rawOutput the raw stdout of `git status --porcelain=v1 -z`
 * @returns {StatusEntry[]}
 */
export function parsePorcelainStatusZ(rawOutput) {
  const tokens = rawOutput.split("\0");
  if (tokens.length > 0 && tokens[tokens.length - 1] === "") tokens.pop();

  /** @type {StatusEntry[]} */
  const entries = [];
  let index = 0;
  while (index < tokens.length) {
    const token = tokens[index];
    const x = token.slice(0, 1);
    const y = token.slice(1, 2);
    const pathText = token.slice(3);
    index += 1;

    /** @type {string | null} */
    let origPath = null;
    if (RENAME_OR_COPY.has(x) || RENAME_OR_COPY.has(y)) {
      origPath = tokens[index] ?? null;
      index += 1;
    }
    entries.push({ x, y, path: pathText, origPath });
  }
  return entries;
}

/**
 * @param {StatusEntry} entry
 * @returns {string[]} every path this entry touches (one for a plain change, two for a
 *   rename/copy), each repository-relative with `\` normalized to `/`.
 */
export function entryPaths(entry) {
  const paths = [normalize(entry.path)];
  if (entry.origPath !== null) paths.push(normalize(entry.origPath));
  return paths;
}

/**
 * @param {string} rawPath
 * @returns {string}
 */
function normalize(rawPath) {
  return String(rawPath || "")
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .trim();
}

/**
 * @param {StatusEntry[]} entries
 * @param {string} allowedPrefix a repository-relative directory prefix, e.g. `"releases/"`
 * @returns {boolean} whether any entry touches a path outside `allowedPrefix`
 */
export function isDirtyOutsidePrefix(entries, allowedPrefix) {
  return entries.some((entry) => entryPaths(entry).some((path) => !path.startsWith(allowedPrefix)));
}
