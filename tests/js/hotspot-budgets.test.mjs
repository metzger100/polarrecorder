/**
 * Contract test for the persistent per-file hotspot-budget owner: `hotspot-budgets.json`'s
 * named, reviewed ceilings (each below 400 and no more than 10 lines above its captured
 * clean count) for files close enough to the repo's global 400-non-empty-line limit that
 * unbounded growth deserves an earlier warning. This is independent of and does not
 * replace the global file-size/anti-compression gate (`tools/check-file-size.mjs` /
 * `tools/check-python-filesize.py`). This is the Vitest contract replacement for the
 * retired tools/quality-policy/check-hotspot-budgets.mjs; every assertion it made is
 * preserved below.
 */

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "vitest";

const ROOT = process.cwd();
const GLOBAL_LIMIT = 400;

/**
 * @param {string} absolutePath
 * @returns {number}
 */
function countNonEmptyLines(absolutePath) {
  const text = fs.readFileSync(absolutePath, "utf8");
  return text.split("\n").filter((line) => line.trim().length > 0).length;
}

/**
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
function runHotspotBudgetsCheck(options = {}) {
  const root = options.root || ROOT;
  const budgetsPath = path.join(root, "tools", "quality-policy", "hotspot-budgets.json");
  const data = JSON.parse(fs.readFileSync(budgetsPath, "utf8"));

  /** @type {string[]} */
  const failures = [];
  for (const [relativePath, budget] of Object.entries(data.budgets)) {
    if (typeof budget !== "number" || budget >= GLOBAL_LIMIT || budget <= 0) {
      failures.push(`${relativePath}: invalid budget ${budget} (must be a positive number below ${GLOBAL_LIMIT})`);
      continue;
    }
    const filePath = path.join(root, relativePath);
    if (!fs.existsSync(filePath)) {
      failures.push(`${relativePath}: missing file for a recorded hotspot budget`);
      continue;
    }
    const actual = countNonEmptyLines(filePath);
    if (actual > budget) {
      failures.push(`${relativePath}: ${actual} non-empty lines exceeds its hotspot budget of ${budget}`);
    }
  }

  return { ok: failures.length === 0, failures };
}

/**
 * A hotspot budget is a ceiling, not a floor, so its ratchet runs the opposite direction
 * from a coverage floor: a live budget may only stay the same or tighten, never loosen
 * past its frozen baseline value.
 * @param {{root?: string}} [options]
 * @returns {{ok: boolean, failures: string[]}}
 */
function checkHotspotBudgetRatchet(options = {}) {
  const root = options.root || ROOT;
  const live = JSON.parse(fs.readFileSync(path.join(root, "tools", "quality-policy", "hotspot-budgets.json"), "utf8"));
  const baseline = JSON.parse(
    fs.readFileSync(path.join(root, "tools", "quality-policy", "hotspot-budgets-baseline.json"), "utf8")
  );

  /** @type {string[]} */
  const failures = [];
  for (const [relativePath, ceiling] of Object.entries(baseline.ceilings)) {
    const current = live.budgets[relativePath];
    if (typeof current !== "number") continue;
    if (current > /** @type {number} */ (ceiling)) {
      failures.push(`${relativePath}: budget ${current} loosened past its frozen ceiling of ${ceiling}`);
    }
  }
  return { ok: failures.length === 0, failures };
}

/**
 * @param {Record<string, number>} budgets
 * @param {Record<string, string>} files
 * @param {Record<string, number>} [ceilings] Baseline ceilings; defaults to `budgets` itself
 *   so tests unrelated to the ratchet never trip it.
 * @returns {string}
 */
function makeFakeRoot(budgets, files, ceilings = budgets) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "polarrecorder-hotspot-"));
  fs.mkdirSync(path.join(root, "tools", "quality-policy"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "hotspot-budgets.json"),
    JSON.stringify({ capturedDate: "2026-07-24", budgets: budgets })
  );
  fs.writeFileSync(
    path.join(root, "tools", "quality-policy", "hotspot-budgets-baseline.json"),
    JSON.stringify({ capturedDate: "2026-07-27", ceilings: ceilings })
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
  const result = runHotspotBudgetsCheck({ root: ROOT });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("a file over its budget fails", () => {
  const root = makeFakeRoot({ "a.py": 5 }, { "a.py": linesOf(6) });
  const result = runHotspotBudgetsCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("exceeds its hotspot budget")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("an invalid budget at or above the global limit fails", () => {
  const root = makeFakeRoot({ "a.py": 400 }, { "a.py": linesOf(5) });
  const result = runHotspotBudgetsCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("invalid budget")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a missing budgeted file fails", () => {
  const root = makeFakeRoot({ "missing.py": 10 }, {});
  const result = runHotspotBudgetsCheck({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("missing file")));
  fs.rmSync(root, { recursive: true, force: true });
});

test("the real repo's live budgets never loosen past the frozen baseline", () => {
  const result = checkHotspotBudgetRatchet({ root: ROOT });
  assert.equal(result.ok, true, result.failures.join("\n"));
});

test("a tightened budget passes the ratchet", () => {
  const root = makeFakeRoot({ "a.py": 5 }, { "a.py": linesOf(5) }, { "a.py": 10 });
  const result = checkHotspotBudgetRatchet({ root });
  assert.equal(result.ok, true, result.failures.join("\n"));
  fs.rmSync(root, { recursive: true, force: true });
});

test("a loosened budget fails the ratchet", () => {
  const root = makeFakeRoot({ "a.py": 15 }, { "a.py": linesOf(15) }, { "a.py": 10 });
  const result = checkHotspotBudgetRatchet({ root });
  assert.equal(result.ok, false);
  assert.ok(result.failures.some((f) => f.includes("loosened past its frozen ceiling")));
  fs.rmSync(root, { recursive: true, force: true });
});
