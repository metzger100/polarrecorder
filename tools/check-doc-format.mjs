#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const REQUIRED_SECTIONS = ["Overview", "Key Details", "Related"];

/**
 * @param {string} content
 * @returns {boolean}
 */
function hasTitle(content) {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim().length === 0) continue;
    return /^#\s+\S/.test(line);
  }
  return false;
}

/**
 * @param {string} content
 * @returns {boolean}
 */
function hasStatus(content) {
  return /^\*\*Status:\*\*.+$/m.test(content);
}

/**
 * @param {string} content
 * @param {string} name
 * @returns {boolean}
 */
function hasSection(content, name) {
  const escaped = name.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
  return new RegExp(`^##\\s+${escaped}\\b`, "m").test(content);
}

/**
 * @param {string} startPath
 * @returns {string[]}
 */
function collectMarkdownFiles(startPath) {
  if (!fs.existsSync(startPath)) return [];
  /** @type {string[]} */
  const out = [];
  walk(startPath, out);
  return out.sort();
}

/**
 * @param {string} currentPath
 * @param {string[]} out
 * @returns {void}
 */
function walk(currentPath, out) {
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    if (currentPath.endsWith(".md")) out.push(currentPath);
    return;
  }
  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    walk(path.join(currentPath, entry.name), out);
  }
}

/**
 * Verify every `documentation/**\/*.md` file has a title, `Status`, and the required sections.
 *
 * @param {{root?: string, print?: boolean}} [options]
 * @returns {{ok: boolean, checkedDocs: number, failures: number}}
 */
export function runDocFormatCheck(options = {}) {
  const root = options.root || process.cwd();
  const print = options.print !== false;
  const docRoot = path.join(root, "documentation");
  const docFiles = collectMarkdownFiles(docRoot);

  /** @type {{file: string, message: string}[]} */
  const findings = [];

  for (const file of docFiles) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");

    if (!hasTitle(content))
      findings.push({ file: rel, message: "missing '# Title' heading at top of file." });
    if (!hasStatus(content)) findings.push({ file: rel, message: "missing '**Status:**' line." });
    for (const section of REQUIRED_SECTIONS) {
      if (!hasSection(content, section)) {
        findings.push({ file: rel, message: `missing '## ${section}' section.` });
      }
    }
  }

  const summary = {
    ok: findings.length === 0,
    checkedDocs: docFiles.length,
    failures: findings.length
  };

  if (print) {
    if (!summary.ok) {
      for (const finding of findings)
        console.error(`[doc-format] ${finding.file}: ${finding.message}`);
      console.error("SUMMARY_JSON=" + JSON.stringify(summary));
    } else {
      console.log("Doc format check passed.");
      console.log("SUMMARY_JSON=" + JSON.stringify(summary));
    }
  }

  return summary;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = runDocFormatCheck();
  process.exitCode = result.ok ? 0 : 1;
}
