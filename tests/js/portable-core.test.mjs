/**
 * Shared portable-core contract tests. Fixtures use only product-neutral paths and content.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "vitest";

import { duplicateJsonKeys } from "../../tools/portable-core/json.mjs";
import { resolveContainedPath } from "../../tools/portable-core/path-policy.mjs";
import { runComplexityPolicy, STRICT_LIMITS } from "../../tools/portable-core/complexity-engine.mjs";
import { normalizeCoverageSummary, runCoveragePolicy } from "../../tools/portable-core/coverage-engine.mjs";
import { runFileSizePolicy } from "../../tools/portable-core/file-size-engine.mjs";
import { runFocusedTestPolicy } from "../../tools/portable-core/focused-test-engine.mjs";
import { runProfileSchemaCheck } from "../../tools/portable-core/schema-engine.mjs";
import { runDocumentationLinkPolicy } from "../../tools/portable-core/doc-link-engine.mjs";
import { runFormatPolicy } from "../../tools/portable-core/format-engine.mjs";
import { runTestInventoryPolicy } from "../../tools/portable-core/test-inventory-engine.mjs";
import { runHookPolicy } from "../../tools/portable-core/hook-engine.mjs";
import { runReleasePolicy } from "../../tools/portable-core/release-engine.mjs";
import { runPortableCoreAttest } from "../../tools/portable-core-attest.mjs";
import { runStandaloneBoundaryCheck } from "../../tools/check-standalone-boundary.mjs";

const ROOT = process.cwd();

test("duplicate JSON keys are rejected before parsing", () => {
  assert.deepEqual(duplicateJsonKeys('{"a": 1, "a": 2}'), ["a"]);
  assert.deepEqual(duplicateJsonKeys('{"a": 1, "b": 2}'), []);
});

test("path policy rejects absolute and traversal paths", () => {
  assert.equal(resolveContainedPath(ROOT, "/tmp/out").ok, false);
  assert.equal(resolveContainedPath(ROOT, "../out").ok, false);
  assert.equal(resolveContainedPath(ROOT, "tests/fixtures/portable-core/clean.txt").ok, true);
});

test("generic policy engines fail closed", () => {
  assert.deepEqual(runFileSizePolicy({ files: { clean: "x\n" }, limit: 1 }).failures, []);
  assert.equal(runFileSizePolicy({ files: { large: "x\nx\n" }, limit: 1 }).ok, false);
  assert.equal(runComplexityPolicy({ limits: STRICT_LIMITS }).ok, true);
  assert.equal(runComplexityPolicy({ limits: STRICT_LIMITS, findings: { fresh: 1 } }).ok, false);
  assert.equal(
    runCoveragePolicy({
      summary: { sample: { lines: 90, functions: 90, statements: 90, branches: 90 } },
      floors: { sample: 90 }
    }).ok,
    true
  );
  assert.equal(
    runCoveragePolicy({
      summary: { sample: { lines: 80, functions: 80, statements: 80, branches: 80 } },
      floors: { sample: 90 }
    }).ok,
    false
  );
  assert.equal(normalizeCoverageSummary({ lines: 101, functions: 90, statements: 90, branches: 90 }).ok, false);
  assert.equal(runCoveragePolicy({ summary: {}, floors: {} }).ok, false);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["a", "b"] }).ok, true);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["b", "a"], baselinePayload: ["a", "b"] }).ok, true);
  assert.equal(runReleasePolicy({ version: "1.2.3", payload: ["../outside"] }).ok, false);
});

test("every portable policy engine has clean and failing cases", () => {
  assert.equal(runFocusedTestPolicy({ files: { clean: 'test("x", () => true);' } }).ok, true);
  assert.equal(runFocusedTestPolicy({ files: { focused: 'test.only("x", () => true);' } }).ok, false);
  assert.equal(
    runProfileSchemaCheck({ profile: { schemaVersion: 1 }, allowedFields: ["schemaVersion"], schemaVersion: 1 }).ok,
    true
  );
  assert.equal(
    runProfileSchemaCheck({ profile: { schemaVersion: 2 }, allowedFields: ["schemaVersion"], schemaVersion: 1 }).ok,
    false
  );
  assert.equal(runDocumentationLinkPolicy({ links: { doc: ["README.md"] }, files: ["README.md"] }).ok, true);
  assert.equal(runDocumentationLinkPolicy({ links: { doc: ["missing.md"] }, files: [] }).ok, false);
  assert.equal(runFormatPolicy({ rows: [{ path: "a.js", owner: "prettier" }], owners: ["prettier"] }).ok, true);
  assert.equal(runFormatPolicy({ rows: [{ path: "a.js", owner: "unknown" }], owners: ["prettier"] }).ok, false);
  assert.equal(
    runTestInventoryPolicy({ entries: { "a.test.mjs": { classification: "strict" } }, livePaths: ["a.test.mjs"] }).ok,
    true
  );
  assert.equal(runTestInventoryPolicy({ entries: {}, livePaths: ["a.test.mjs"] }).ok, false);
  assert.equal(
    runTestInventoryPolicy({
      entries: { "a.test.mjs": { classification: "strict" } },
      livePaths: ["a.test.mjs", "a.test.mjs"]
    }).ok,
    false
  );
  assert.equal(runHookPolicy({ root: ROOT, paths: ["../outside"] }).ok, false);
  assert.equal(runHookPolicy({ root: ROOT, paths: [".githooks/pre-push"] }).ok, true);
});

test("the generic fixture is present and readable", () => {
  const fixture = path.join(ROOT, "tests", "fixtures", "portable-core", "clean.txt");
  assert.equal(fs.readFileSync(fixture, "utf8"), "portable core fixture\n");
});

test("attestation is anonymous, deterministic, and schema-shaped", () => {
  const first = runPortableCoreAttest({ root: ROOT, print: false });
  const second = runPortableCoreAttest({ root: ROOT, print: false });
  assert.equal(first, second);
  const parsed = JSON.parse(first);
  const golden = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tests", "fixtures", "portable-core", "attestation.json"), "utf8")
  );
  assert.deepEqual(parsed, golden);
  assert.deepEqual(Object.keys(parsed), ["coreVersion", "manifestSha256", "entries"]);
  assert.equal(runStandaloneBoundaryCheck({ root: ROOT, print: false }).ok, true);
});
