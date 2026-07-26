/**
 * Self-tests for tools/quality-policy/check-hotspot-budgets.mjs, the persistent per-file
 * hotspot-budget owner.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { runHotspotBudgetsCheck } from "../../tools/quality-policy/check-hotspot-budgets.mjs";

/**
 * @param {Record<string, number>} budgets
 * @param {Record<string, string>} files
 * @returns {string}
 */
function makeFakeRoot(budgets, files) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-hotspot-"));
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "hotspot-budgets.json"),
    JSON.stringify({ capturedDate: "2026-07-24", budgets: budgets })
  );
  for (const [name, content] of Object.entries(files)) {
    fs.writeFileSync(path.join(root, name), content);
  }
  return root;
}

/**
 * @param {number} count
 * @returns {string}
 */
function linesOf(count) {
  return Array.from({ length: count }, (_unused, i) => `line ${i}`).join("\n") + "\n";
}

test("real repo budgets pass", () => {
  const result = runHotspotBudgetsCheck({ print: false });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("a file over its budget fails", () => {
  const root = makeFakeRoot({ "a.py": 5 }, { "a.py": linesOf(6) });
  const result = runHotspotBudgetsCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("exceeds its hotspot budget")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an invalid budget at or above the global limit fails", () => {
  const root = makeFakeRoot({ "a.py": 400 }, { "a.py": linesOf(5) });
  const result = runHotspotBudgetsCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("invalid budget")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a missing budgeted file fails", () => {
  const root = makeFakeRoot({ "missing.py": 10 }, {});
  const result = runHotspotBudgetsCheck({ root, print: false });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing file")));
  fs.rmSync(root, { recursive: true, force: true });
});
