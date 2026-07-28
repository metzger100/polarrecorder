/**
 * Contract test for the converged documentation-shape rule: every documentation/**\/*.md
 * file needs a title, a `**Status:**` line, and the `Overview`, `Key Details`, and
 * `Related` sections. This is the Vitest contract replacement for the retired
 * tools/check-doc-format.mjs; every assertion it made is preserved below.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

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
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, checkedDocs: number, failures: number}}
 */
function runDocFormatCheck(options = {}) {
  const root = options.root || process.cwd();
  const docRoot = path.join(root, "documentation");
  const docFiles = collectMarkdownFiles(docRoot);

  /** @type {{file: string, message: string}[]} */
  const findings = [];

  for (const file of docFiles) {
    const rel = path.relative(root, file).replace(/\\/g, "/");
    const content = fs.readFileSync(file, "utf8");

    if (!hasTitle(content)) findings.push({ file: rel, message: "missing '# Title' heading at top of file." });
    if (!hasStatus(content)) findings.push({ file: rel, message: "missing '**Status:**' line." });
    for (const section of REQUIRED_SECTIONS) {
      if (!hasSection(content, section)) {
        findings.push({ file: rel, message: `missing '## ${section}' section.` });
      }
    }
  }

  return { ok: findings.length === 0, checkedDocs: docFiles.length, failures: findings.length };
}

const ROOT = process.cwd();

/** @returns {string} */
function makeTempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-doc-format-"));
}

/** @param {string} root */
function cleanup(root) {
  fs.rmSync(root, { recursive: true, force: true });
}

/**
 * A minimal, fully valid doc: one page satisfying every required section.
 * @param {string} root
 * @returns {void}
 */
function writeValidDoc(root) {
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    ["# Guide", "", "**Status:** Current.", "", "## Overview", "", "## Key Details", "", "## Related", ""].join("\n")
  );
}

test("real repo passes", () => {
  const result = runDocFormatCheck({ root: ROOT });
  assert.equal(result.ok, true);
});

test("a valid temp doc tree passes", () => {
  const root = makeTempRoot();
  writeValidDoc(root);
  const result = runDocFormatCheck({ root });
  assert.equal(result.ok, true);
  cleanup(root);
});

test("a doc missing a required section fails", () => {
  const root = makeTempRoot();
  fs.mkdirSync(path.join(root, "documentation"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "documentation", "guide.md"),
    ["# Guide", "", "**Status:** Current.", "", "## Overview", ""].join("\n")
  );
  const result = runDocFormatCheck({ root });
  assert.equal(result.ok, false);
  cleanup(root);
});
