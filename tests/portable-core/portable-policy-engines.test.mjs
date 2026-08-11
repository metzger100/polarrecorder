/**
 * Executable clean and failing cases for every canonical portable policy engine.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "vitest";

import { STRICT_LIMITS, runComplexityPolicy } from "../../tools/portable-core/complexity-engine.mjs";
import { runCoveragePolicy } from "../../tools/portable-core/coverage-engine.mjs";
import { normalizeCoverageSummary } from "../../tools/portable-core/coverage-engine.mjs";
import { runDocumentationLinkPolicy } from "../../tools/portable-core/doc-link-engine.mjs";
import { runFileSizePolicy } from "../../tools/portable-core/file-size-engine.mjs";
import { runFocusedTestPolicy } from "../../tools/portable-core/focused-test-engine.mjs";
import { runFormatPolicy } from "../../tools/portable-core/format-engine.mjs";
import { runHookPolicy } from "../../tools/portable-core/hook-engine.mjs";
import { duplicateJsonKeys } from "../../tools/portable-core/json.mjs";
import { resolveContainedPath } from "../../tools/portable-core/path-policy.mjs";
import { runReleasePolicy } from "../../tools/portable-core/release-engine.mjs";
import { runProfileSchemaCheck } from "../../tools/portable-core/schema-engine.mjs";
import { runSuppressionCheck } from "../../tools/portable-core/suppression-engine.mjs";
import { runTestInventoryPolicy } from "../../tools/portable-core/test-inventory-engine.mjs";

const ROOT = process.cwd();

test("canonical pure policy engines accept clean input and reject failing input", function () {
  expect(runFileSizePolicy({ files: { a: "x\n" }, limit: 1 }).ok).toBe(true);
  expect(runFileSizePolicy({ files: { a: "x\nx\n" }, limit: 1 }).ok).toBe(false);
  expect(runFocusedTestPolicy({ files: { a: "test('x', fn);" } }).ok).toBe(true);
  expect(runFocusedTestPolicy({ files: { a: "test.only('x', fn);" } }).ok).toBe(false);
  expect(runComplexityPolicy({ limits: STRICT_LIMITS }).ok).toBe(true);
  expect(runComplexityPolicy({ limits: { ...STRICT_LIMITS, complexity: 11 } }).ok).toBe(false);
  const coverage = { a: { lines: 90, functions: 90, statements: 90, branches: 90 } };
  expect(runCoveragePolicy({ summary: coverage, floors: { a: 90 } }).ok).toBe(true);
  expect(runCoveragePolicy({ summary: coverage, floors: { a: 91 } }).ok).toBe(false);
  expect(runDocumentationLinkPolicy({ links: { a: ["b"] }, files: ["b"] }).ok).toBe(true);
  expect(runDocumentationLinkPolicy({ links: { a: ["b"] }, files: [] }).ok).toBe(false);
  expect(runFormatPolicy({ rows: [{ path: "a", owner: "x" }], owners: ["x"] }).ok).toBe(true);
  expect(runFormatPolicy({ rows: [{ path: "a", owner: "y" }], owners: ["x"] }).ok).toBe(false);
  const schema = { allowedFields: ["schemaVersion"], schemaVersion: 1 };
  expect(runProfileSchemaCheck({ ...schema, profile: { schemaVersion: 1 } }).ok).toBe(true);
  expect(runProfileSchemaCheck({ ...schema, profile: { schemaVersion: 2 } }).ok).toBe(false);
  expect(runReleasePolicy({ version: "1.2.3", payload: ["a"] }).ok).toBe(true);
  expect(runReleasePolicy({ version: "bad", payload: ["../a"] }).ok).toBe(false);
  expect(runTestInventoryPolicy({ entries: { a: { classification: "strict" } }, livePaths: ["a"] }).ok).toBe(true);
  expect(runTestInventoryPolicy({ entries: {}, livePaths: ["a"] }).ok).toBe(false);
  expect(duplicateJsonKeys('{"a":1}')).toEqual([]);
  expect(duplicateJsonKeys('{"a":1,"a":2}')).toEqual(["a"]);
});

test("canonical filesystem policy engines accept clean input and reject failing input", function () {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "portable-policy-"));
  const hook = path.join(root, "hook");
  fs.writeFileSync(hook, "#!/bin/sh\n");
  fs.chmodSync(hook, 0o755);
  expect(runHookPolicy({ root, paths: ["hook"] }).ok).toBe(true);
  expect(runHookPolicy({ root, paths: ["missing"] }).ok).toBe(false);
  expect(resolveContainedPath(root, "hook").ok).toBe(true);
  expect(resolveContainedPath(root, "../hook").ok).toBe(false);
  fs.writeFileSync(path.join(root, "clean.js"), "const value = 1;\n");
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(true);
  fs.writeFileSync(path.join(root, "string.js"), 'const text = "eslint-disable-next-line";\n');
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(true);
  fs.writeFileSync(
    path.join(root, "fenced.md"),
    ["```js\n", "const value = 1; // ", "eslint-disable-next-line no-alert\n", "```\n"].join("")
  );
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(false);
  fs.rmSync(path.join(root, "fenced.md"));
  fs.writeFileSync(path.join(root, "clean.py"), "value = 1\n");
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(true);
  fs.writeFileSync(path.join(root, "bad.py"), ["value = 1  # ", "noqa\n"].join(""));
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(false);
  fs.writeFileSync(path.join(root, "bad.js"), ["// eslint", "-disable\n"].join(""));
  expect(runSuppressionCheck({ root, print: false }).ok).toBe(false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("canonical policy engine edge cases remain covered", () => {
  assert.deepEqual(duplicateJsonKeys('{"a": 1, "a": 2}'), ["a"]);
  assert.deepEqual(duplicateJsonKeys('{"a": 1, "b": 2}'), []);
  assert.equal(resolveContainedPath(ROOT, "/tmp/out").ok, false);
  assert.equal(resolveContainedPath(ROOT, "../out").ok, false);
  assert.equal(resolveContainedPath(ROOT, "tests/portable-core/fixtures/clean.txt").ok, true);
  assert.equal(runComplexityPolicy({ limits: STRICT_LIMITS, findings: { fresh: 1 } }).ok, false);
  assert.equal(normalizeCoverageSummary({ lines: 101, functions: 90, statements: 90, branches: 90 }).ok, false);
  assert.equal(runCoveragePolicy({ summary: {}, floors: {} }).ok, false);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["a", "b"] }).ok, true);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["b", "a"], baselinePayload: ["a", "b"] }).ok, true);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["../outside"] }).ok, false);
  assert.equal(
    fs.readFileSync(path.join(ROOT, "tests", "portable-core", "fixtures", "clean.txt"), "utf8"),
    "portable core fixture\n"
  );
});
