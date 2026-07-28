/**
 * Self-tests for tools/quality-policy/check-coverage-inventory.mjs, the combined Python +
 * viewer/plugin JS coverage inventory and ratchet.
 *
 * The expected SHA-256 of tools/quality-policy/baseline-coverage-capture.json is
 * hardcoded here, independent of the file itself, so a coordinated edit that lowers a
 * historical floor and updates coverage-floor-baseline.json to match still requires a
 * visible, reviewable change to this anchor (mirroring test-inventory.test.mjs's
 * exception-baseline digest).
 */

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import { test } from "vitest";
import path from "node:path";

import {
  checkFloorRatchet,
  deriveCoverageFloorBaseline,
  diffCoverageFloorBaseline,
  runCoverageInventoryCheck
} from "../../tools/quality-policy/check-coverage-inventory.mjs";

const ROOT = process.cwd();
const EXPECTED_BASELINE_CAPTURE_DIGEST = "a3af7e341a4dda51616808e2df14c034c130c0b5df1260ace8dee5f037addf62";

test("the baseline coverage capture is byte-anchored", () => {
  const capturePath = path.join(ROOT, "tools", "quality-policy", "baseline-coverage-capture.json");
  const digest = crypto.createHash("sha256").update(fs.readFileSync(capturePath)).digest("hex");
  assert.equal(digest, EXPECTED_BASELINE_CAPTURE_DIGEST);
});

test("the committed baseline matches the value derived from the real capture", () => {
  const result = diffCoverageFloorBaseline(ROOT);
  assert.equal(result.ok, true, result.failures.join("\n"));
  const derived = deriveCoverageFloorBaseline(ROOT);
  const committed = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "coverage-floor-baseline.json"), "utf8")
  );
  assert.deepEqual(derived, committed);
});

test("the real coverage-floors.json never falls below its baseline", () => {
  const result = checkFloorRatchet(ROOT);
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("detects a coverage-floor-baseline.json that no longer matches the capture", () => {
  const root = makeFakeRoot();
  const baselinePath = path.join(root, "tools", "quality-policy", "coverage-floor-baseline.json");
  const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  baseline.minimumFloors.families.pythonAggregateCombinedPercent = 1;
  fs.writeFileSync(baselinePath, JSON.stringify(baseline));
  const result = diffCoverageFloorBaseline(root);
  assert.equal(result.ok, false);
  fs.rmSync(root, { recursive: true, force: true });
});

test("detects an active floor lowered below its baseline (family, plugin.py, and per-file)", () => {
  const root = makeFakeRoot();
  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.families.validationPackageLinePercent = 1;
  floors.pluginPy.combinedLineAndBranchPercent = 1;
  floors.viewerPerFileLinePercent["viewer/dom.js"] = 1;
  fs.writeFileSync(floorsPath, JSON.stringify(floors));
  const result = checkFloorRatchet(root);
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("families.validationPackageLinePercent")));
  assert.ok(result.failures.some((f) => f.includes("pluginPy.combinedLineAndBranchPercent")));
  assert.ok(result.failures.some((f) => f.includes('viewerPerFileLinePercent["viewer/dom.js"]')));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a clean fake root with matching reports passes the full inventory check", () => {
  const root = makeFakeRoot();
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when a shipped python file is neither measured nor contract-owned", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "python", "coverage.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  delete report.files["server/polarrecorder/histogram.py"];
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("server/polarrecorder/histogram.py") && f.includes("not measured")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when a shipped viewer file is neither measured nor contract-owned", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "viewer", "coverage-summary.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  delete report[path.join(root, "viewer", "a.js")];
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("viewer/a.js") && f.includes("not measured")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when a viewer file drops below its per-file line floor", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "viewer", "coverage-summary.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report[path.join(root, "viewer", "a.js")].lines.pct = 10;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("viewer/a.js") && f.includes("below the 80% floor")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when the viewer family aggregate drops below its floor", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "viewer", "coverage-summary.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report[path.join(root, "viewer", "a.js")].branches.pct = 0;
  report[path.join(root, "viewer", "a.js")].branches.covered = 0;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("viewer family branches")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when plugin.py drops below its per-file combined floor", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "python", "coverage.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.files["plugin.py"].summary.percent_covered = 1;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("plugin.py combined")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("fails when the validation package family drops below its floor", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "python", "coverage.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  report.files["server/polarrecorder/validation/angle_math.py"].summary.covered_lines = 0;
  fs.writeFileSync(reportPath, JSON.stringify(report));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("validation package lines")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("accepts a python file classified contract-owned when unmeasured and the owner is real", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "python", "coverage.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  delete report.files["server/polarrecorder/histogram.py"];
  fs.writeFileSync(reportPath, JSON.stringify(report));

  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tests", "test_histogram.py"),
    "from polarrecorder.histogram import speed_key\n\n\ndef test_speed_key() -> None:\n    assert speed_key(1.0) == 10\n"
  );
  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.contractOwned.python["server/polarrecorder/histogram.py"] = {
    ownerTest: "tests/test_histogram.py::test_speed_key",
    reason: "fake fixture proof, not a real exemption"
  };
  fs.writeFileSync(floorsPath, JSON.stringify(floors));

  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("rejects a contract-owned python entry whose owner test does not import the target", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "python", "coverage.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  delete report.files["server/polarrecorder/histogram.py"];
  fs.writeFileSync(reportPath, JSON.stringify(report));

  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(path.join(root, "tests", "test_histogram.py"), "def test_speed_key() -> None:\n    assert 1 == 1\n");
  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.contractOwned.python["server/polarrecorder/histogram.py"] = {
    ownerTest: "tests/test_histogram.py::test_speed_key",
    reason: "fake fixture proof, not a real exemption"
  };
  fs.writeFileSync(floorsPath, JSON.stringify(floors));

  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("does not import")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("rejects a contract-owned entry whose target file is actually measured", () => {
  const root = makeFakeRoot();
  fs.mkdirSync(path.join(root, "tests"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tests", "test_histogram.py"),
    "from polarrecorder.histogram import speed_key\n\n\ndef test_speed_key() -> None:\n    assert speed_key(1.0) == 10\n"
  );
  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.contractOwned.python["server/polarrecorder/histogram.py"] = {
    ownerTest: "tests/test_histogram.py::test_speed_key",
    reason: "invalid: histogram.py is still measured in the report"
  };
  fs.writeFileSync(floorsPath, JSON.stringify(floors));

  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(
    result.failures.some((f) => f.includes("histogram.py") && f.includes("has measured executable coverage data"))
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("rejects a contract-owned entry pointing at a file that no longer exists", () => {
  const root = makeFakeRoot();
  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.contractOwned.python["server/polarrecorder/deleted.py"] = {
    ownerTest: "tests/test_histogram.py::test_speed_key",
    reason: "stale entry"
  };
  fs.writeFileSync(floorsPath, JSON.stringify(floors));
  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("deleted.py") && f.includes("no longer exists")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("rejects a contract-owned javascript entry whose owner is not runner-discovered", () => {
  const root = makeFakeRoot();
  const reportPath = path.join(root, "coverage", "viewer", "coverage-summary.json");
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  delete report[path.join(root, "viewer", "a.js")];
  fs.writeFileSync(reportPath, JSON.stringify(report));

  const floorsPath = path.join(root, "tools", "quality-policy", "coverage-floors.json");
  const floors = JSON.parse(fs.readFileSync(floorsPath, "utf8"));
  floors.contractOwned.javascript["viewer/a.js"] = {
    ownerTest: "tests/js/does-not-exist.test.mjs"
  };
  fs.writeFileSync(floorsPath, JSON.stringify(floors));

  const result = runCoverageInventoryCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("is not a runner-discovered test")));
  fs.rmSync(root, { recursive: true, force: true });
});

/** @returns {string} */
function makeFakeRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-coverage-inventory-"));
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.mkdirSync(path.join(root, "tests", "js"), { recursive: true });
  fs.mkdirSync(path.join(root, "server", "polarrecorder", "validation"), { recursive: true });
  fs.mkdirSync(path.join(root, "viewer"), { recursive: true });
  fs.mkdirSync(path.join(root, "coverage", "python"), { recursive: true });
  fs.mkdirSync(path.join(root, "coverage", "viewer"), { recursive: true });

  fs.writeFileSync(path.join(root, "plugin.py"), "PLUGIN_MARKER = True\n");
  fs.writeFileSync(
    path.join(root, "server", "polarrecorder", "histogram.py"),
    "def speed_key(x: float) -> int:\n    return round(x * 10.0)\n"
  );
  fs.writeFileSync(
    path.join(root, "server", "polarrecorder", "validation", "angle_math.py"),
    "def circular_distance(a: float, b: float) -> float:\n    return abs(a - b)\n"
  );
  fs.writeFileSync(path.join(root, "viewer", "a.js"), "window.Polarrecorder = {};\n");
  fs.writeFileSync(path.join(root, "plugin.js"), "// legacy stub\n");
  fs.writeFileSync(path.join(root, "plugin.mjs"), "export default {};\n");

  // Reuse the real, mutually-consistent baseline capture and its derived baseline so
  // baseline-derivation and ratchet checks stay green by default; only coverage-floors.json
  // needs an extra entry for this fake root's one real viewer file, "viewer/a.js".
  fs.copyFileSync(
    path.join(ROOT, "tools", "quality-policy", "baseline-coverage-capture.json"),
    path.join(root, "tools", "quality-policy", "baseline-coverage-capture.json")
  );
  fs.copyFileSync(
    path.join(ROOT, "tools", "quality-policy", "coverage-floor-baseline.json"),
    path.join(root, "tools", "quality-policy", "coverage-floor-baseline.json")
  );
  const floors = JSON.parse(
    fs.readFileSync(path.join(ROOT, "tools", "quality-policy", "coverage-floors.json"), "utf8")
  );
  // Keep every real historical key (checkFloorRatchet requires them all present at or
  // above baseline) and add this fake root's own one real viewer file on top.
  floors.viewerPerFileLinePercent["viewer/a.js"] = 80.0;
  floors.contractOwned = { javascript: {}, python: {} };
  fs.writeFileSync(path.join(root, "tools", "quality-policy", "coverage-floors.json"), JSON.stringify(floors));

  fs.writeFileSync(path.join(root, "coverage", "python", "coverage.json"), JSON.stringify(fakePythonReport()));
  fs.writeFileSync(
    path.join(root, "coverage", "viewer", "coverage-summary.json"),
    JSON.stringify(fakeViewerReport(root))
  );
  return root;
}

/** @returns {any} */
function fakePythonReport() {
  const file = () => ({
    summary: {
      covered_lines: 10,
      num_statements: 10,
      percent_covered: 100,
      covered_branches: 4,
      num_branches: 4
    }
  });
  return {
    files: {
      "plugin.py": file(),
      "server/polarrecorder/histogram.py": file(),
      "server/polarrecorder/validation/angle_math.py": file()
    },
    totals: { percent_covered: 100 }
  };
}

/**
 * @param {string} root
 * @returns {any}
 */
function fakeViewerReport(root) {
  const entry = () => ({
    lines: { total: 10, covered: 10, pct: 100 },
    functions: { total: 2, covered: 2, pct: 100 },
    statements: { total: 10, covered: 10, pct: 100 },
    branches: { total: 4, covered: 4, pct: 100 }
  });
  return {
    total: entry(),
    [path.join(root, "viewer", "a.js")]: entry(),
    [path.join(root, "plugin.js")]: entry(),
    [path.join(root, "plugin.mjs")]: entry()
  };
}
