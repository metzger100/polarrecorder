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
 * @typedef {object} NamespaceSummary
 * @property {boolean} ok Whether the check found zero failures.
 * @property {number} checkedJsFiles Count of viewer JS files scanned.
 * @property {number} failures Count of failures found.
 */

/**
 * @typedef {object} NamespaceCheckResult
 * @property {boolean} ok Whether the check found zero failures.
 * @property {string[]} failures Human-readable failure messages.
 * @property {NamespaceSummary} summary Machine-readable summary of the run.
 */

/**
 * Checks that viewer JS files export functionality only through
 * `window.Polarrecorder` and never assign other globals.
 *
 * @param {object} [options] Check options.
 * @param {string} [options.root] Repository root to scan from.
 * @param {boolean} [options.print] Whether to print results to the console.
 * @returns {NamespaceCheckResult} The check outcome.
 */
export function runNamespaceCheck({ root = process.cwd(), print = true } = {}) {
  const viewerRoot = path.join(root, "viewer");
  const failures = [];
  const files = collectViewerJsFiles(viewerRoot);

  for (const file of files) {
    const content = fs.readFileSync(file.abs, "utf8");
    if (!content.includes("window.Polarrecorder")) {
      failures.push(`${file.rel}: missing window.Polarrecorder namespace usage`);
    }
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index += 1) {
      const matches = lines[index].matchAll(/\bwindow\.([A-Za-z_$][\w$]*)\s*=/g);
      for (const match of matches) {
        if (match[1] !== "Polarrecorder") {
          failures.push(`${file.rel}:${index + 1}: illegal global window.${match[1]} assignment`);
        }
      }
    }
  }

  const summary = {
    ok: failures.length === 0,
    checkedJsFiles: files.length,
    failures: failures.length
  };

  if (print) reportNamespace(failures, summary);
  return { ok: summary.ok, failures, summary };
}

/**
 * Prints namespace check results to the console.
 *
 * @param {string[]} failures Human-readable failure messages.
 * @param {NamespaceSummary} summary Machine-readable summary of the run.
 * @returns {void}
 */
function reportNamespace(failures, summary) {
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[namespace] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("Namespace check passed.");
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runNamespaceCheck().ok ? 0 : 1);
}
