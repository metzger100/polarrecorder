/**
 * Self-test for `tools/quality-policy/run-format.mjs`'s `runFormat()`: it iterates
 * `format-scope.json`'s classification only (no project-specific value beyond the venv
 * environment variable name it already reads from `project-hook-environment.json`), so a
 * fixture root with a symlinked `node_modules/.bin/prettier` and its own scope file can prove
 * both a clean pass and a check-mode failure without touching the real repository tree.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import { runFormat } from "../../tools/quality-policy/run-format.mjs";

const ROOT = process.cwd();

/**
 * @param {string} sampleContent
 * @returns {string}
 */
function makeFixtureRoot(sampleContent) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "run-format-fixture-"));
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"));
  fs.writeFileSync(path.join(root, "sample.mjs"), sampleContent);
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "format-scope.json"),
    JSON.stringify({ rows: [{ path: "sample.mjs", owner: "prettier" }] })
  );
  return root;
}

test("a cleanly formatted fixture passes format:check", () => {
  const root = makeFixtureRoot('export const value = "clean";\n');
  const result = runFormat({ mode: "check", root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, true);
});

test("a badly formatted fixture fails format:check", () => {
  const root = makeFixtureRoot("export const value    =    'not clean'\n");
  const result = runFormat({ mode: "check", root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
});

test("write mode reformats a badly formatted fixture in place", () => {
  const root = makeFixtureRoot("export const value    =    'not clean'\n");
  const written = runFormat({ mode: "write", root });
  assert.equal(written.ok, true);
  const checked = runFormat({ mode: "check", root });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(checked.ok, true);
});

test("the real repository is already format:check-clean", () => {
  const result = runFormat({ mode: "check", root: ROOT });
  assert.equal(result.ok, true);
});
