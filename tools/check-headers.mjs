#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

/**
 * @typedef {object} ViewerFile
 * @property {string} abs Absolute path to the viewer file.
 * @property {string} rel Path to the viewer file, relative to the repo root.
 */

/**
 * @typedef {object} HeadersSummary
 * @property {boolean} ok Whether the check found zero failures.
 * @property {number} checkedJsFiles Count of viewer JS files scanned.
 * @property {number} failures Count of failures found.
 */

/**
 * @typedef {object} HeadersCheckResult
 * @property {boolean} ok Whether the check found zero failures.
 * @property {string[]} failures Human-readable failure messages.
 * @property {HeadersSummary} summary Machine-readable summary of the run.
 */

/**
 * Checks that every viewer JS file has a top JSDoc Module header with
 * `Module`, `Documentation`, and `Depends` fields, and that the
 * `Documentation` target exists on disk.
 *
 * @param {object} [options] Check options.
 * @param {string} [options.root] Repository root to scan from.
 * @param {boolean} [options.print] Whether to print results to the console.
 * @returns {HeadersCheckResult} The check outcome.
 */
export function runHeadersCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const failures = [];
  const files = collectViewerJsFiles(viewerRoot);

  for (const file of files) {
    const content = fs.readFileSync(file.abs, "utf8");
    const header = extractTopHeader(content);
    if (!header) {
      failures.push(`${file.rel}: missing top /** Module */ header`);
      continue;
    }
    for (const field of ["Module", "Documentation", "Depends"]) {
      if (!new RegExp(`^\\s*\\*\\s*${field}:\\s*.+$`, "m").test(header)) {
        failures.push(`${file.rel}: header missing ${field}`);
      }
    }
    const docMatch = header.match(/^\s*\*\s*Documentation:\s*(.+?)\s*$/m);
    if (docMatch) {
      const docPath = docMatch[1].trim().replace(/[?#].*$/, "");
      if (!fs.existsSync(path.join(root, docPath))) {
        failures.push(`${file.rel}: Documentation target does not exist: ${docPath}`);
      }
    }
  }

  const summary = {
    ok: failures.length === 0,
    checkedJsFiles: files.length,
    failures: failures.length
  };

  if (print) reportHeaders(failures, summary);
  return { ok: summary.ok, failures, summary };
}

/**
 * Prints header check results to the console.
 *
 * @param {string[]} failures Human-readable failure messages.
 * @param {HeadersSummary} summary Machine-readable summary of the run.
 * @returns {void}
 */
function reportHeaders(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[headers] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Header check passed.");
  console.log("SUMMARY_JSON=" + JSON.stringify(summary));
}

/**
 * Lists viewer JS files under the given viewer root.
 *
 * @param {string} viewerRoot Absolute path to the viewer directory.
 * @returns {ViewerFile[]} Viewer JS files, sorted by filename.
 */
function collectViewerJsFiles(viewerRoot) {
  if (!fs.existsSync(viewerRoot)) return [];
  return fs
    .readdirSync(viewerRoot)
    .filter((name) => name.endsWith(".js"))
    .sort()
    .map((name) => ({ abs: path.join(viewerRoot, name), rel: `viewer/${name}` }));
}

/**
 * Extracts the leading JSDoc-style block comment from a file's content, if
 * present at the very start of the file (skipping a BOM and whitespace).
 *
 * @param {string} content Full file content.
 * @returns {string | null} The header comment text, or `null` if absent.
 */
function extractTopHeader(content) {
  let index = 0;
  if (content.charCodeAt(0) === 0xfeff) index = 1;
  while (/\s/.test(content[index] || "")) index += 1;
  if (!content.startsWith("/**", index)) return null;
  const end = content.indexOf("*/", index + 3);
  return end >= 0 ? content.slice(index, end + 2) : null;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runHeadersCheck().ok ? 0 : 1);
}
