/**
 * Self-tests for tools/quality-policy/generate-format-scope.mjs, the
 * machine-readable maintained-file format disposition.
 */

import assert from "node:assert/strict";
import { test } from "vitest";

import {
  HISTORICAL_EXCLUSION_PATTERNS,
  runFormatScopeGeneration
} from "../../tools/quality-policy/generate-format-scope.mjs";

test("every row has a sanctioned owner", () => {
  const rows = runFormatScopeGeneration();
  const validOwners = new Set(["prettier", "ruff", "unsupported"]);
  for (const row of rows) {
    assert.ok(validOwners.has(row.owner), `${row.path} has unrecognized owner ${row.owner}`);
  }
});

test("every unsupported row has a reason and alternate validation", () => {
  const rows = runFormatScopeGeneration();
  for (const row of rows) {
    if (row.owner === "unsupported") {
      assert.ok(row.reason, `${row.path} is unsupported without a reason`);
      assert.ok(row.alternateValidation, `${row.path} is unsupported without an alternate validation owner`);
    }
  }
});

/**
 * @param {Map<string, {path: string, owner: string}>} byPath
 * @param {string} relativePath
 * @returns {string}
 */
function ownerOf(byPath, relativePath) {
  const row = byPath.get(relativePath);
  assert.ok(row, `${relativePath} is missing from the format scope`);
  return row.owner;
}

test("known families classify as expected", () => {
  const rows = runFormatScopeGeneration();
  const byPath = new Map(rows.map((row) => [row.path, row]));
  assert.equal(ownerOf(byPath, "plugin.py"), "ruff");
  assert.equal(ownerOf(byPath, "viewer/viewer.js"), "prettier");
  assert.equal(ownerOf(byPath, "viewer/viewer.html"), "prettier");
  assert.equal(ownerOf(byPath, "viewer/viewer-shell.css"), "prettier");
  assert.equal(ownerOf(byPath, "package.json"), "prettier");
  assert.equal(ownerOf(byPath, "package-lock.json"), "prettier");
  assert.equal(ownerOf(byPath, ".github/workflows/publish-release.yml"), "prettier");
  assert.equal(ownerOf(byPath, "pyproject.toml"), "unsupported");
  assert.equal(ownerOf(byPath, "viewer/icon.svg"), "unsupported");
  assert.equal(ownerOf(byPath, "install.sh"), "unsupported");
  assert.equal(ownerOf(byPath, "tests/mock-data/status.json"), "unsupported");
  assert.equal(ownerOf(byPath, "tests/mock-data/export-windy.csv"), "unsupported");
  assert.equal(ownerOf(byPath, "tools/quality-policy/baseline-coverage-capture.json"), "unsupported");
});

test("historical artifacts are excluded, not unsupported", () => {
  const rows = runFormatScopeGeneration();
  const paths = new Set(rows.map((row) => row.path));
  assert.ok(!paths.has("releases/polarrecorder-1.0.0-beta.1.zip"));
  assert.ok(
    HISTORICAL_EXCLUSION_PATTERNS.some((pattern) => pattern.test("exec-plans/completed/PLAN9001.md")),
    "a seeded completed-plan path must match the historical exclusion pattern"
  );
});

test("deleted tracked files are absent from fresh discovery", () => {
  const rows = runFormatScopeGeneration();
  const paths = new Set(rows.map((row) => row.path));
  assert.ok(!paths.has("tools/check-patterns/discovery.mjs"));
});
