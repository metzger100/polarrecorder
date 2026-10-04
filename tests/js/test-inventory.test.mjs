/**
 * Self-tests for tools/quality-policy/test-inventory.mjs, the strict-typing owner for every
 * executable JS test/helper file. Live discovery is the only file list: a discovered file outside
 * tsconfig.tests.json's include globs fails, and a type error in any discovered file fails tsc.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

import {
  discoverExecutableTestHelpers,
  filesOutsideTypecheckScope,
  includeGlobToRegExp,
  runTypecheckTests
} from "../../tools/quality-policy/test-inventory.mjs";

const ROOT = process.cwd();
const CLEAN_TEST = 'import { test } from "vitest";\n\ntest("ok", () => {});\n';

test("discovery finds every real tests/js/*.test.mjs file and the viewer harness", () => {
  const discovered = discoverExecutableTestHelpers(ROOT);
  assert.ok(discovered.includes("tests/js/test-inventory.test.mjs"));
  assert.ok(discovered.includes("tools/viewer-harness.mjs"));
  assert.ok(!discovered.some((file) => file.startsWith("tools/viewer-harness/")));
});

test("every real discovered file is inside tsconfig.tests.json's include globs", () => {
  assert.deepEqual(filesOutsideTypecheckScope(ROOT), []);
});

test("include globs match within one segment for * and across segments for **", () => {
  const nested = includeGlobToRegExp("tests/js/**/*.test.mjs");
  assert.ok(nested.test("tests/js/a.test.mjs"));
  assert.ok(nested.test("tests/js/deep/b.test.mjs"));
  assert.ok(!nested.test("tests/js/a.mjs"));
  const flat = includeGlobToRegExp("tools/*-harness.mjs");
  assert.ok(flat.test("tools/viewer-harness.mjs"));
  assert.ok(!flat.test("tools/viewer-harness/fake-dom.mjs"));
});

test("the real repo executable test/helper set typechecks clean", () => {
  const result = runTypecheckTests({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(result.checkedFiles >= 15);
});

test("a discovered test file outside the include globs fails before tsc runs", () => {
  const root = makeFakeRoot(["tests/js/a.test.mjs", "tests/js/nested/b.test.mjs"], ["tests/js/*.test.mjs"]);
  const result = runTypecheckTests({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["tests/js/nested/b.test.mjs is outside tsconfig.tests.json's include globs"]);
  assert.equal(result.checkedFiles, 0);
});

test("a type error in a discovered test file fails the typecheck", () => {
  const root = makeFakeRoot(["tests/js/a.test.mjs"], ["tests/js/**/*.test.mjs"]);
  assert.equal(runTypecheckTests({ root, print: false }).ok, true);
  fs.writeFileSync(
    path.join(root, "tests", "js", "a.test.mjs"),
    "/** @type {number} */\nexport const value = 'text';\n"
  );
  const result = runTypecheckTests({ root, print: false });
  fs.rmSync(root, { recursive: true, force: true });
  assert.equal(result.ok, false);
  assert.deepEqual(result.failures, ["tsc reported errors over the discovered test files"]);
});

test("a tsconfig that lists files instead of include globs is rejected", () => {
  const root = makeFakeRoot(["tests/js/a.test.mjs"], ["tests/js/**/*.test.mjs"]);
  const tsconfigPath = path.join(root, "tsconfig.tests.json");
  const config = JSON.parse(fs.readFileSync(tsconfigPath, "utf8"));
  config.files = ["tests/js/a.test.mjs"];
  fs.writeFileSync(tsconfigPath, JSON.stringify(config));
  assert.throws(() => filesOutsideTypecheckScope(root), /must scope tests with "include" globs/);
  fs.rmSync(root, { recursive: true, force: true });
});

/**
 * A fake repository with the real compiler options, the given test files, and the given
 * include globs; node_modules is symlinked so tsc resolves vitest and @types/node.
 * @param {string[]} live
 * @param {string[]} include
 * @returns {string}
 */
function makeFakeRoot(live, include) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-test-typecheck-"));
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  for (const rel of live) {
    fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    fs.writeFileSync(path.join(root, rel), CLEAN_TEST);
  }
  fs.symlinkSync(path.join(ROOT, "node_modules"), path.join(root, "node_modules"));
  const config = JSON.parse(fs.readFileSync(path.join(ROOT, "tsconfig.tests.json"), "utf8"));
  fs.writeFileSync(
    path.join(root, "tsconfig.tests.json"),
    JSON.stringify({ compilerOptions: config.compilerOptions, include })
  );
  return root;
}
