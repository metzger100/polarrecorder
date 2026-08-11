#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { runFileSizePolicy } from "./portable-core/file-size-engine.mjs";

import { countFindingsByKind, detectOneliners, ONELINER_MESSAGE_BY_KIND } from "./check-file-size/oneliner-rules.mjs";

const MAX_ALLOWED_LINES = 400;
// project-file-size-scope.json is a fixed project config, not part of the (possibly fake)
// scan root under test, so it is always read from the real repository, mirroring
// check-doc-links.mjs's linkinator.config.json convention.
const PROJECT_SCOPE_PATH = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "quality-policy",
  "project-file-size-scope.json"
);

/**
 * @returns {{rootMarkdownFiles: string[], rootJsFiles: string[], viewerScanRoot: string, documentationScanRoot: string, toolsScanRoot: string}}
 */
function readProjectScope() {
  return JSON.parse(fs.readFileSync(PROJECT_SCOPE_PATH, "utf8"));
}

/**
 * @typedef {import("./check-file-size/oneliner-rules.mjs").OnelinerKind} OnelinerKind
 * @typedef {import("./check-file-size/oneliner-rules.mjs").OnelinerFinding} OnelinerFinding
 * @typedef {import("./check-file-size/oneliner-rules.mjs").OnelinerCountsByKind} OnelinerCountsByKind
 */

/**
 * @typedef {object} TargetFile
 * @property {string} abs - Absolute filesystem path.
 * @property {string} rel - Path relative to the scanned root, forward-slashed.
 */

/**
 * @typedef {object} FileSizeOptions
 * @property {string} [root] - Repository root to scan; defaults to process.cwd().
 * @property {"warn"|"block"} [onelinerMode] - Whether one-liner findings fail the gate or only warn.
 * @property {boolean} [print] - Whether to log a human-readable report.
 */

/**
 * @typedef {object} FileSizeSummary
 * @property {boolean} ok
 * @property {number} checkedFiles
 * @property {number} failures
 * @property {"warn"|"block"} onelinerMode
 * @property {number} onelinerFindings
 * @property {OnelinerCountsByKind} onelinerByKind
 */

/**
 * @typedef {object} FileSizeResult
 * @property {boolean} ok
 * @property {string[]} failures
 * @property {OnelinerFinding[]} onelinerFindings
 * @property {FileSizeSummary} summary
 */

/**
 * @param {FileSizeOptions} [options]
 * @returns {FileSizeResult}
 */
export function runFileSizeCheck({ root = process.cwd(), onelinerMode = "warn", print = true } = {}) {
  /** @type {string[]} */
  const failures = [];
  /** @type {OnelinerFinding[]} */
  const onelinerFindings = [];
  const targetFiles = collectTargetFiles(root);

  for (const file of targetFiles) {
    const content = fs.readFileSync(file.abs, "utf8");
    const nonEmptyLines = content.split(/\r?\n/).filter((line) => line.trim().length > 0).length;
    if (!runFileSizePolicy({ files: { [file.rel]: content }, limit: MAX_ALLOWED_LINES }).ok) {
      failures.push(`${file.rel}: ${nonEmptyLines} non-empty lines (limit ${MAX_ALLOWED_LINES})`);
    }
    // Oneliner-density rules target hand-written viewer/entrypoint JS read by a human on every
    // change; tools/**/*.mjs only gets the line-count limit here (typecheck/lint/tests already
    // govern its style), so a dense but well-tested existing tool helper is not retroactively
    // penalized by a rule it was never written against.
    if (!file.rel.startsWith("tools/") && (file.rel.endsWith(".js") || file.rel.endsWith(".mjs"))) {
      detectOneliners(file, content, onelinerFindings);
    }
  }

  const warnings = [];
  for (const finding of onelinerFindings) {
    const reason = ONELINER_MESSAGE_BY_KIND[finding.kind];
    const line = `[oneliner] ${finding.file}:${finding.line}: ${reason} (${finding.kind}, length ${finding.length})`;
    if (onelinerMode === "block") failures.push(line);
    else warnings.push(line);
  }

  const summary = {
    ok: failures.length === 0,
    checkedFiles: targetFiles.length,
    failures: failures.length,
    onelinerMode,
    onelinerFindings: onelinerFindings.length,
    onelinerByKind: countFindingsByKind(onelinerFindings)
  };

  if (print) reportFileSize(failures, warnings, summary);
  return { ok: summary.ok, failures, onelinerFindings, summary };
}

/**
 * @param {string[]} failures
 * @param {string[]} warnings
 * @param {FileSizeSummary} summary
 * @returns {void}
 */
function reportFileSize(failures, warnings, summary) {
  for (const warning of warnings) console.warn(warning);
  if (failures.length > 0) {
    for (const failure of failures) console.error(`[file-size] ${failure}`);
    console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    return;
  }
  console.log("File size check passed.");
  console.log(
    "SUMMARY_JSON=" + JSON.stringify({ ok: true, checkedFiles: summary.checkedFiles, failures: 0, warnings: 0 })
  );
}

/**
 * @param {string} root
 * @returns {TargetFile[]}
 */
function collectTargetFiles(root) {
  const scope = readProjectScope();
  const viewerRoot = path.join(root, scope.viewerScanRoot);
  const docRoot = path.join(root, scope.documentationScanRoot);
  const toolsRoot = path.join(root, scope.toolsScanRoot);
  const out = [];
  if (fs.existsSync(viewerRoot)) {
    for (const name of fs.readdirSync(viewerRoot)) {
      if (name.endsWith(".js") || name.endsWith(".css") || name.endsWith(".html")) {
        const abs = path.join(viewerRoot, name);
        out.push({ abs, rel: toRel(root, abs) });
      }
    }
  }
  for (const name of scope.rootJsFiles) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) out.push({ abs, rel: name });
  }
  if (fs.existsSync(docRoot)) walkMarkdown(root, docRoot, out);
  for (const name of scope.rootMarkdownFiles) {
    const abs = path.join(root, name);
    if (fs.existsSync(abs)) out.push({ abs, rel: name });
  }
  if (fs.existsSync(toolsRoot)) walkToolsJs(root, toolsRoot, out);
  return out.sort((a, b) => a.rel.localeCompare(b.rel));
}

/**
 * @param {string} root
 * @param {string} currentPath
 * @param {TargetFile[]} out
 * @returns {void}
 */
function walkToolsJs(root, currentPath, out) {
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    if (entry.name === "__pycache__") continue;
    const abs = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      walkToolsJs(root, abs, out);
    } else if (entry.name.endsWith(".mjs")) {
      out.push({ abs, rel: toRel(root, abs) });
    }
  }
}

/**
 * @param {string} root
 * @param {string} currentPath
 * @param {TargetFile[]} out
 * @returns {void}
 */
function walkMarkdown(root, currentPath, out) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    if (currentPath.endsWith(".md")) out.push({ abs: currentPath, rel: toRel(root, currentPath) });
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    walkMarkdown(root, path.join(currentPath, entry.name), out);
  }
}

/**
 * @param {string} root
 * @param {string} absolutePath
 * @returns {string}
 */
function toRel(root, absolutePath) {
  return path.relative(root, absolutePath).replace(/\\/g, "/");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const mode = process.argv.includes("--oneliner=block") ? "block" : "warn";
  process.exit(runFileSizeCheck({ onelinerMode: mode }).ok ? 0 : 1);
}
