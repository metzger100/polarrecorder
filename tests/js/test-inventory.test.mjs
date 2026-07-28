/**
 * Self-tests for tools/quality-policy/test-inventory.mjs, the permanent
 * strict-typing and inventory owner for every executable JS test/helper file.
 *
 * The expected SHA-256 of tools/quality-policy/test-exception-baseline.json is
 * hardcoded here, independent of the file itself, so a coordinated edit that both
 * adds an exception and updates this test still requires a visible, reviewable change
 * to this anchor.
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import {
  checkPlannedFixtureProvenance,
  diffTestInventory,
  diffTsconfigTestsInventory,
  discoverExecutableTestHelpers,
  runTestInventoryCheck,
  runTypecheckTests
} from "../../tools/quality-policy/test-inventory.mjs";

const ROOT = process.cwd();
const EXPECTED_EXCEPTION_BASELINE_DIGEST = "8badbd89598135ab6fdec4f59e7cf645941599c931a38330bba0054fae26243a";

test("the exception baseline is byte-anchored and empty", () => {
  const baselinePath = path.join(ROOT, "tools", "quality-policy", "test-exception-baseline.json");
  const digest = crypto.createHash("sha256").update(fs.readFileSync(baselinePath)).digest("hex");
  assert.equal(digest, EXPECTED_EXCEPTION_BASELINE_DIGEST);
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  assert.deepEqual(baseline.exceptions, []);
});

test("discovery finds every real tests/js/*.test.mjs file and the viewer harness", () => {
  const discovered = discoverExecutableTestHelpers(ROOT);
  assert.ok(discovered.includes("tests/js/test-inventory.test.mjs"));
  assert.ok(discovered.includes("tools/viewer-harness.mjs"));
});

test("discovery matches the real repo inventory with no drift", () => {
  const { missingFromInventory, extraInInventory, nonStrictEntries } = diffTestInventory(ROOT);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, []);
  assert.deepEqual(nonStrictEntries, []);
});

test("tsconfig.tests.json's include list matches live discovery with no drift", () => {
  const { missingFromTsconfig, extraInTsconfig } = diffTsconfigTestsInventory();
  assert.deepEqual(missingFromTsconfig, []);
  assert.deepEqual(extraInTsconfig, []);
});

test("detects a live file missing from tsconfig.tests.json", () => {
  const root = makeFakeRoot({ inventory: [], live: ["tests/js/a.test.mjs"] });
  const tsconfigPath = path.join(root, "tsconfig.tests.json");
  fs.writeFileSync(tsconfigPath, JSON.stringify({ include: [] }));
  const { missingFromTsconfig, extraInTsconfig } = diffTsconfigTestsInventory(root, tsconfigPath);
  assert.deepEqual(missingFromTsconfig, ["tests/js/a.test.mjs"]);
  assert.deepEqual(extraInTsconfig, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("detects a stale tsconfig.tests.json include entry", () => {
  const root = makeFakeRoot({ inventory: [], live: ["tests/js/a.test.mjs"] });
  const tsconfigPath = path.join(root, "tsconfig.tests.json");
  fs.writeFileSync(tsconfigPath, JSON.stringify({ include: ["tests/js/a.test.mjs", "tests/js/removed.test.mjs"] }));
  const { missingFromTsconfig, extraInTsconfig } = diffTsconfigTestsInventory(root, tsconfigPath);
  assert.deepEqual(missingFromTsconfig, []);
  assert.deepEqual(extraInTsconfig, ["tests/js/removed.test.mjs"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("the real repo test inventory check passes", () => {
  const result = runTestInventoryCheck({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("the real repo executable test/helper set typechecks clean", () => {
  const result = runTypecheckTests({ root: ROOT, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  assert.ok(result.checkedFiles >= 15);
});

test("detects a live file missing from the committed inventory", () => {
  const root = makeFakeRoot({
    inventory: [{ path: "tests/js/a.test.mjs", classification: "strict" }],
    live: ["tests/js/a.test.mjs", "tests/js/b.test.mjs"]
  });
  const { missingFromInventory, extraInInventory } = diffTestInventory(root);
  assert.deepEqual(missingFromInventory, ["tests/js/b.test.mjs"]);
  assert.deepEqual(extraInInventory, []);
  fs.rmSync(root, { recursive: true, force: true });
});

test("detects a stale committed inventory entry", () => {
  const root = makeFakeRoot({
    inventory: [
      { path: "tests/js/a.test.mjs", classification: "strict" },
      { path: "tests/js/removed.test.mjs", classification: "strict" }
    ],
    live: ["tests/js/a.test.mjs"]
  });
  const { missingFromInventory, extraInInventory } = diffTestInventory(root);
  assert.deepEqual(missingFromInventory, []);
  assert.deepEqual(extraInInventory, ["tests/js/removed.test.mjs"]);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a non-strict classification on an executable fails", () => {
  const root = makeFakeRoot({
    inventory: [{ path: "tests/js/a.test.mjs", classification: "fixture" }],
    live: ["tests/js/a.test.mjs"]
  });
  writeExceptionBaseline(root, []);
  writePlannedFixtures(root, []);
  const result = runTestInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("classified non-strict")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a non-empty exception baseline fails", () => {
  const root = makeFakeRoot({
    inventory: [{ path: "tests/js/a.test.mjs", classification: "strict" }],
    live: ["tests/js/a.test.mjs"]
  });
  writeExceptionBaseline(root, ["tests/js/a.test.mjs"]);
  writePlannedFixtures(root, []);
  const result = runTestInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("non-empty")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an unplanned quality fixture fails", () => {
  const root = makeFakeRoot({ inventory: [], live: [] });
  writeExceptionBaseline(root, []);
  writePlannedFixtures(root, []);
  fs.mkdirSync(path.join(root, "tests", "fixtures", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, "tests", "fixtures", "quality", "rogue.json"), "{}\n");
  const failures = checkPlannedFixtureProvenance(root);
  assert.ok(failures.some((f) => f.includes("unplanned quality fixture")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an executable planned fixture fails", () => {
  const root = makeFakeRoot({ inventory: [], live: [] });
  const fixtureRel = "tests/fixtures/quality/bad.mjs";
  fs.mkdirSync(path.join(root, "tests", "fixtures", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, fixtureRel), "export const x = 1;\n");
  fs.writeFileSync(path.join(root, "tests", "referencer.mjs"), `// references ${fixtureRel}\n`);
  writePlannedFixtures(root, [
    {
      path: fixtureRel,
      sha256: sha256File(path.join(root, fixtureRel)),
      ownerTest: "tests/js/example.test.mjs",
      rule: "example-rule",
      reason: "proves the example rule"
    }
  ]);
  const failures = checkPlannedFixtureProvenance(root);
  assert.ok(failures.some((f) => f.includes("must not be executable")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a hash-mismatched planned fixture fails", () => {
  const root = makeFakeRoot({ inventory: [], live: [] });
  const fixtureRel = "tests/fixtures/quality/data.json";
  fs.mkdirSync(path.join(root, "tests", "fixtures", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, fixtureRel), '{"value": 1}\n');
  fs.writeFileSync(path.join(root, "tests", "referencer.mjs"), `// references ${fixtureRel}\n`);
  writePlannedFixtures(root, [
    {
      path: fixtureRel,
      sha256: "0".repeat(64),
      ownerTest: "tests/js/example.test.mjs",
      rule: "example-rule",
      reason: "proves the example rule"
    }
  ]);
  const failures = checkPlannedFixtureProvenance(root);
  assert.ok(failures.some((f) => f.includes("does not match its captured hash")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an unused planned fixture fails", () => {
  const root = makeFakeRoot({ inventory: [], live: [] });
  const fixtureRel = "tests/fixtures/quality/data.json";
  fs.mkdirSync(path.join(root, "tests", "fixtures", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, fixtureRel), '{"value": 1}\n');
  writePlannedFixtures(root, [
    {
      path: fixtureRel,
      sha256: sha256File(path.join(root, fixtureRel)),
      ownerTest: "tests/js/example.test.mjs",
      rule: "example-rule",
      reason: "proves the example rule"
    }
  ]);
  const failures = checkPlannedFixtureProvenance(root);
  assert.ok(failures.some((f) => f.includes("is unused")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an ownerless planned fixture fails", () => {
  const root = makeFakeRoot({ inventory: [], live: [] });
  const fixtureRel = "tests/fixtures/quality/data.json";
  fs.mkdirSync(path.join(root, "tests", "fixtures", "quality"), { recursive: true });
  fs.writeFileSync(path.join(root, fixtureRel), '{"value": 1}\n');
  fs.writeFileSync(path.join(root, "tests", "referencer.mjs"), `// references ${fixtureRel}\n`);
  writePlannedFixtures(root, [
    {
      path: fixtureRel,
      sha256: sha256File(path.join(root, fixtureRel)),
      ownerTest: "",
      rule: "example-rule",
      reason: "proves the example rule"
    }
  ]);
  const failures = checkPlannedFixtureProvenance(root);
  assert.ok(failures.some((f) => f.includes("ownerless")));
  fs.rmSync(root, { recursive: true, force: true });
});

/**
 * @param {string} filePath
 * @returns {string}
 */
function sha256File(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

/**
 * @param {{inventory: {path: string, classification: string}[], live: string[]}} options
 * @returns {string}
 */
function makeFakeRoot({ inventory, live }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-test-inventory-"));
  fs.mkdirSync(path.join(root, "tests", "js"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  for (const rel of live) {
    fs.writeFileSync(path.join(root, rel), 'import { test } from "vitest";\n');
  }
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "test-inventory.json"),
    JSON.stringify({ note: "fake", executableTestHelpers: inventory })
  );
  writeExceptionBaseline(root, []);
  writePlannedFixtures(root, []);
  return root;
}

/**
 * @param {string} root
 * @param {string[]} exceptions
 */
function writeExceptionBaseline(root, exceptions) {
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "test-exception-baseline.json"),
    JSON.stringify({ note: "fake", capturedCommit: "0".repeat(40), exceptions })
  );
}

/**
 * @param {string} root
 * @param {{path: string, sha256: string, ownerTest: string, rule: string, reason: string}[]} plannedFixtures
 */
function writePlannedFixtures(root, plannedFixtures) {
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "planned-quality-fixtures.json"),
    JSON.stringify({ note: "fake", capturedCommit: "0".repeat(40), plannedFixtures })
  );
}
