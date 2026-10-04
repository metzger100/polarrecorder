/**
 * Contract test closing the "stale tool reference" smell class: every `tools/...` path named
 * in `pyproject.toml`, `package.json`, or any `documentation/**\/*.md` file must exist on disk,
 * and every backticked `tests/...` path or simple glob (`*` within a segment, `**` across
 * segments) in a documentation table cell must resolve to at least one real file, so an
 * enforcement cell cannot keep naming a retired test or checker unnoticed.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const TOOL_PATH_PATTERN = /\btools\/[\w./-]*\.(?:mjs|py|sh)\b/g;
const TABLE_PATH_PATTERN = /`((?:tests|tools)\/[^`\s]+)`/g;

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listMarkdownFiles(dir) {
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listMarkdownFiles(abs));
    else if (entry.name.endsWith(".md")) out.push(abs);
  }
  return out;
}

/**
 * @param {string} content
 * @returns {string[]}
 */
function findToolPaths(content) {
  return [...content.matchAll(TOOL_PATH_PATTERN)].map((m) => m[0]);
}

/**
 * @param {string[]} sourceFiles
 * @returns {{sourceFile: string, toolPath: string}[]}
 */
function collectMissing(sourceFiles) {
  /** @type {{sourceFile: string, toolPath: string}[]} */
  const missing = [];
  for (const sourceFile of sourceFiles) {
    const content = fs.readFileSync(sourceFile, "utf8");
    for (const toolPath of findToolPaths(content)) {
      if (!fs.existsSync(path.join(ROOT, toolPath))) {
        missing.push({ sourceFile: path.relative(ROOT, sourceFile), toolPath });
      }
    }
  }
  return missing;
}

/**
 * Backticked `tests/...` paths and `tests/`/`tools/` globs named in Markdown table rows.
 * @param {string} content
 * @returns {string[]}
 */
function findTableReferences(content) {
  /** @type {string[]} */
  const references = [];
  for (const line of content.split(/\r?\n/)) {
    if (!line.trimStart().startsWith("|")) continue;
    for (const match of line.matchAll(TABLE_PATH_PATTERN)) {
      if (match[1].startsWith("tests/") || match[1].includes("*")) references.push(match[1]);
    }
  }
  return references;
}

/**
 * @param {string} glob
 * @returns {RegExp}
 */
function globToRegExp(glob) {
  const escaped = glob.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp("^" + escaped.replace(/\*\*\//g, "(?:.*/)?").replace(/\*/g, "[^/]*") + "$");
}

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  /** @type {string[]} */
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listFiles(abs));
    else out.push(path.relative(ROOT, abs).split(path.sep).join("/"));
  }
  return out;
}

/**
 * @param {string} reference
 * @returns {boolean}
 */
function resolvesOnDisk(reference) {
  if (!reference.includes("*")) return fs.existsSync(path.join(ROOT, reference));
  const staticPrefix = reference.slice(0, reference.indexOf("*"));
  const baseDir = staticPrefix.slice(0, staticPrefix.lastIndexOf("/") + 1);
  const pattern = globToRegExp(reference);
  return listFiles(path.join(ROOT, baseDir)).some((file) => pattern.test(file));
}

test("every tools/ path named in pyproject.toml, package.json, and documentation/**/*.md exists on disk", () => {
  const sourceFiles = [
    path.join(ROOT, "pyproject.toml"),
    path.join(ROOT, "package.json"),
    ...listMarkdownFiles(path.join(ROOT, "documentation"))
  ];
  const missing = collectMissing(sourceFiles);
  assert.deepEqual(missing, [], missing.map((m) => `${m.sourceFile} names nonexistent ${m.toolPath}`).join("\n"));
});

test("a seeded nonexistent tool reference is caught", () => {
  const missing = collectMissing([]);
  assert.deepEqual(missing, []);
  const seeded = "See tools/this-tool-does-not-exist.mjs for details.";
  const found = findToolPaths(seeded);
  assert.deepEqual(found, ["tools/this-tool-does-not-exist.mjs"]);
  assert.equal(fs.existsSync(path.join(ROOT, found[0])), false);
});

test("every tests/ path and tests/ or tools/ glob in a documentation table resolves on disk", () => {
  /** @type {string[]} */
  const unresolved = [];
  for (const sourceFile of listMarkdownFiles(path.join(ROOT, "documentation"))) {
    for (const reference of findTableReferences(fs.readFileSync(sourceFile, "utf8"))) {
      if (!resolvesOnDisk(reference)) unresolved.push(`${path.relative(ROOT, sourceFile)} names ${reference}`);
    }
  }
  assert.deepEqual(unresolved, [], unresolved.join("\n"));
});

test("a stale table path or an empty table glob is caught", () => {
  const table = [
    "| Rule | Enforcement |",
    "| --- | --- |",
    "| Stale | `tests/js/this-test-does-not-exist.test.mjs` |",
    "| Empty glob | `tests/js/no-such-prefix-*.test.mjs` |",
    "| Live glob | `tests/js/viewer-*.test.mjs` |",
    "Prose `tests/js/prose-only-path.test.mjs` outside a table is not a table reference."
  ].join("\n");

  const references = findTableReferences(table);

  assert.deepEqual(references, [
    "tests/js/this-test-does-not-exist.test.mjs",
    "tests/js/no-such-prefix-*.test.mjs",
    "tests/js/viewer-*.test.mjs"
  ]);
  assert.deepEqual(references.map(resolvesOnDisk), [false, false, true]);
});
