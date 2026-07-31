/**
 * Contract test closing the "stale tool reference" smell class: every `tools/...` path named
 * in `pyproject.toml`, `package.json`, or any `documentation/**\/*.md` file must exist on disk.
 * A tool retired without sweeping its remaining mentions (the `tools/check-coverage.py`
 * staleness this phase fixed) would otherwise go unnoticed until a reader followed the dead
 * path.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const TOOL_PATH_PATTERN = /\btools\/[\w./-]*\.(?:mjs|py|sh)\b/g;

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
